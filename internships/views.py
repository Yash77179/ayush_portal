"""Views for internships app."""

from django.db.models import Count, Q
from rest_framework.exceptions import ValidationError
from rest_framework import generics, permissions, status, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import Skill, StudentSkill, Internship, InternshipSkill
from .serializers import (
    SkillSerializer,
    StudentSkillSerializer,
    InternshipListSerializer,
    InternshipDetailSerializer,
    InternshipManageSerializer,
    CompanyInternshipRowSerializer,
)
from institutions.access import company_membership, require_membership
from institutions.models import StudentProfile


class IsCompanyRecruiter(permissions.BasePermission):
    """Allow only users with company role who have a company membership."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "company"


class SkillListView(generics.ListAPIView):
    """Public list of all skills for autocomplete."""
    queryset = Skill.objects.all()
    serializer_class = SkillSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "category"]


class InternshipListView(generics.ListAPIView):
    """Public searchable list of published internships."""
    serializer_class = InternshipListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Internship.objects.filter(status=Internship.Status.PUBLISHED).select_related("company")
        q = self.request.query_params.get("q")
        location = self.request.query_params.get("location")
        work_mode = self.request.query_params.get("work_mode")
        skill = self.request.query_params.get("skill")

        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(description__icontains=q))
        if location:
            qs = qs.filter(location__icontains=location)
        if work_mode:
            qs = qs.filter(work_mode=work_mode)
        if skill:
            qs = qs.filter(required_skills__name__icontains=skill).distinct()
        return qs


class InternshipDetailView(generics.RetrieveAPIView):
    """Full internship details including required skills."""
    queryset = Internship.objects.filter(status=Internship.Status.PUBLISHED)
    serializer_class = InternshipDetailSerializer
    permission_classes = [permissions.AllowAny]


class CompanyInternshipListCreateView(generics.ListCreateAPIView):
    """Recruiter: list their company's internships (with applicant counts) and create new ones."""
    permission_classes = [IsCompanyRecruiter]
    pagination_class = None

    def get_serializer_class(self):
        if self.request.method == "POST":
            return InternshipManageSerializer
        return CompanyInternshipRowSerializer

    def get_queryset(self):
        m = company_membership(self.request.user)
        if m is None:
            return Internship.objects.none()
        active = ["applied", "review", "shortlisted", "interview", "offered"]
        return (
            Internship.objects.filter(company=m.company)
            .select_related("company")
            .annotate(
                applicants=Count("applications", distinct=True),
                active_applicants=Count("applications", filter=Q(applications__status__in=active), distinct=True),
            )
        )

    def perform_create(self, serializer):
        m = require_membership(self.request.user, manage=True)
        serializer.save(company=m.company, posted_by=self.request.user)


class CompanyInternshipDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Recruiter: read, edit (incl. skills, eligibility, screening questions), publish/close or delete a listing."""
    permission_classes = [IsCompanyRecruiter]
    serializer_class = InternshipManageSerializer

    def get_queryset(self):
        m = company_membership(self.request.user)
        if m is None:
            return Internship.objects.none()
        return Internship.objects.filter(company=m.company).prefetch_related("internship_skills__skill", "screening_questions")

    def perform_update(self, serializer):
        require_membership(self.request.user, manage=True)
        serializer.save()

    def perform_destroy(self, instance):
        require_membership(self.request.user, manage=True)
        if instance.applications.exists():
            raise ValidationError("This listing has applicants — close it instead of deleting it.")
        instance.delete()


class StudentSkillListCreateView(generics.ListCreateAPIView):
    """Student: list and add their own skills."""
    serializer_class = StudentSkillSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        profile = StudentProfile.objects.get(user=self.request.user)
        return StudentSkill.objects.filter(student=profile).select_related("skill")

    def perform_create(self, serializer):
        profile = StudentProfile.objects.get(user=self.request.user)
        serializer.save(student=profile)


class StudentSkillDestroyView(generics.DestroyAPIView):
    """Student: remove a skill from their profile."""
    serializer_class = StudentSkillSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        profile = StudentProfile.objects.get(user=self.request.user)
        return StudentSkill.objects.filter(student=profile)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def skill_match_view(request, internship_id):
    """Return skill-match score between the authenticated student and an internship."""
    from .matching import calculate_skill_match
    try:
        profile = StudentProfile.objects.get(user=request.user)
    except StudentProfile.DoesNotExist:
        return Response({"error": "Student profile not found."}, status=404)

    try:
        internship = Internship.objects.get(pk=internship_id)
    except Internship.DoesNotExist:
        return Response({"error": "Internship not found."}, status=404)

    student_skills = list(
        profile.student_skills.select_related("skill").values_list("skill__name", flat=True)
    )
    internship_skills = list(
        internship.internship_skills.select_related("skill").values(
            "skill__name", "is_required"
        )
    )
    skills_input = [{"name": s["skill__name"], "is_required": s["is_required"]} for s in internship_skills]
    match = calculate_skill_match(student_skills, skills_input)
    return Response(match)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def eligibility_view(request, internship_id):
    """Can the signed-in student apply? {eligible, reasons, already_applied, profile_verified}."""
    from applications.models import Application
    from .eligibility import internship_reasons

    internship = Internship.objects.filter(pk=internship_id).first()
    if internship is None:
        return Response({"error": "Internship not found."}, status=404)
    profile = StudentProfile.objects.filter(user=request.user).first()
    if profile is None:
        return Response({"eligible": False, "reasons": ["Complete your student profile first."], "already_applied": False})
    reasons = internship_reasons(profile, internship)
    return Response({
        "eligible": not reasons,
        "reasons": reasons,
        "already_applied": Application.objects.filter(student=profile, internship=internship).exists(),
        "profile_verified": profile.verification_status == "verified",
    })
