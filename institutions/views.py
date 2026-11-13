"""Institutions views."""

import re

from rest_framework import filters, generics, permissions, status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from internships.models import Skill, StudentSkill
from .models import Achievement, Certification, Company, Experience, StudentProfile, University
from .serializers import (
    AchievementSerializer,
    CertificationSerializer,
    CompanySerializer,
    ExperienceSerializer,
    StudentProfileSerializer,
    UniversitySerializer,
)


class UniversityListView(generics.ListCreateAPIView):
    """List/search universities (public). Signed-in users can add one that is missing."""
    queryset = University.objects.all()
    serializer_class = UniversitySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "location"]

    def create(self, request, *args, **kwargs):
        name = " ".join(str(request.data.get("name", "")).split())
        if not 2 <= len(name) <= 200:
            return Response({"name": "Enter a university name (2-200 characters)."}, status=status.HTTP_400_BAD_REQUEST)
        existing = University.objects.filter(name__iexact=name).first()
        if existing:
            return Response(self.get_serializer(existing).data, status=status.HTTP_200_OK)
        university = University.objects.create(name=name, location=str(request.data.get("location", ""))[:200])
        return Response(self.get_serializer(university).data, status=status.HTTP_201_CREATED)


class StudentProfileView(generics.RetrieveUpdateAPIView):
    """Student: get or update their own profile."""
    serializer_class = StudentProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        profile, _ = StudentProfile.objects.get_or_create(user=self.request.user)
        return profile


class CompanyListView(generics.ListAPIView):
    queryset = Company.objects.filter(is_verified=True)
    serializer_class = CompanySerializer
    permission_classes = [permissions.AllowAny]


# ── Student profile extras: experience, certifications, achievements, resume ──

class _OwnedByProfileMixin:
    """Scope a queryset to the signed-in student's profile and attach new rows to it."""

    permission_classes = [permissions.IsAuthenticated]

    def _profile(self):
        profile, _ = StudentProfile.objects.get_or_create(user=self.request.user)
        return profile

    def get_queryset(self):
        return self.model.objects.filter(profile=self._profile())

    def perform_create(self, serializer):
        serializer.save(profile=self._profile())


class ExperienceListView(_OwnedByProfileMixin, generics.ListCreateAPIView):
    model = Experience
    serializer_class = ExperienceSerializer
    pagination_class = None


class ExperienceDetailView(_OwnedByProfileMixin, generics.RetrieveUpdateDestroyAPIView):
    model = Experience
    serializer_class = ExperienceSerializer


class CertificationListView(_OwnedByProfileMixin, generics.ListCreateAPIView):
    model = Certification
    serializer_class = CertificationSerializer
    pagination_class = None


class CertificationDetailView(_OwnedByProfileMixin, generics.RetrieveUpdateDestroyAPIView):
    model = Certification
    serializer_class = CertificationSerializer


class AchievementListView(_OwnedByProfileMixin, generics.ListCreateAPIView):
    model = Achievement
    serializer_class = AchievementSerializer
    pagination_class = None


class AchievementDetailView(_OwnedByProfileMixin, generics.RetrieveUpdateDestroyAPIView):
    model = Achievement
    serializer_class = AchievementSerializer


class ResumeUploadView(APIView):
    """Upload a PDF resume; read it and suggest skills (nothing is added automatically)."""

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser]
    MAX_BYTES = 5 * 1024 * 1024
    MAX_PAGES = 12

    def post(self, request):
        upload = request.FILES.get("file")
        if upload is None:
            return Response({"file": "Choose a PDF file."}, status=status.HTTP_400_BAD_REQUEST)
        if upload.size > self.MAX_BYTES:
            return Response({"file": "Resume must be 5 MB or smaller."}, status=status.HTTP_400_BAD_REQUEST)
        head = upload.read(5)
        upload.seek(0)
        if head != b"%PDF-":
            return Response({"file": "That doesn't look like a PDF."}, status=status.HTTP_400_BAD_REQUEST)

        profile, _ = StudentProfile.objects.get_or_create(user=request.user)
        profile.resume_file.save(f"resume-{request.user.pk}.pdf", upload, save=True)

        upload.seek(0)
        text = self._extract_text(upload)  # read the upload itself, so this works whatever storage holds the file
        have = set(StudentSkill.objects.filter(student=profile).values_list("skill_id", flat=True))
        found = []
        for skill in Skill.objects.all():
            if re.search(rf"(?<![A-Za-z0-9+#]){re.escape(skill.name)}(?![A-Za-z0-9+#])", text, re.IGNORECASE):
                found.append({"id": skill.id, "name": skill.name, "already_added": skill.id in have})
        return Response(
            {
                "resume_file": request.build_absolute_uri(profile.resume_file.url),
                "detected_skills": found,
                "pages_read": min(self.MAX_PAGES, 99),
            },
            status=status.HTTP_200_OK,
        )

    def _extract_text(self, source):
        """`source` is a file path or an open file object."""
        try:
            from pypdf import PdfReader

            reader = PdfReader(source)
            chunks = []
            for page in reader.pages[: self.MAX_PAGES]:
                chunks.append(page.extract_text() or "")
                if sum(len(c) for c in chunks) > 200_000:
                    break
            return "\n".join(chunks)
        except Exception:
            return ""


# ── Company: set-up, profile and team ─────────────────────────────────────

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.parsers import FormParser, JSONParser

from accounts.permissions import role_required
from .access import company_membership, require_membership
from .models import CompanyMembership
from .serializers import CompanyMembershipSerializer, TeamMemberSerializer


def _company_payload(membership):
    data = CompanyMembershipSerializer(membership).data
    data["member_count"] = membership.company.memberships.filter(is_active=True).count()
    return data


class MyCompanyView(APIView):
    """GET your company (404 until you set one up) · POST create it (you become its admin) · PATCH edit it (admins)."""

    permission_classes = [role_required("company")]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        m = company_membership(request.user)
        if m is None:
            return Response({"detail": "no_company"}, status=status.HTTP_404_NOT_FOUND)
        return Response(_company_payload(m))

    def post(self, request):
        if company_membership(request.user):
            return Response({"detail": "You already belong to a company."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = CompanySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            company = serializer.save()
            m = CompanyMembership.objects.create(user=request.user, company=company, role=CompanyMembership.Role.ADMIN)
        return Response(_company_payload(m), status=status.HTTP_201_CREATED)

    def patch(self, request):
        m = require_membership(request.user, admin=True)
        serializer = CompanySerializer(m.company, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        m.refresh_from_db()
        return Response(_company_payload(m))


class TeamView(APIView):
    """GET the team · POST {email, role} add a recruiter who already has a CareerBridge recruiter account (admins)."""

    permission_classes = [role_required("company")]

    def get(self, request):
        m = require_membership(request.user)
        members = m.company.memberships.select_related("user").order_by("-is_active", "joined_at")
        return Response({"my_role": m.role, "results": TeamMemberSerializer(members, many=True).data})

    def post(self, request):
        m = require_membership(request.user, admin=True)
        email = str(request.data.get("email", "")).strip().lower()
        role = request.data.get("role", CompanyMembership.Role.RECRUITER)
        if role not in CompanyMembership.Role.values:
            return Response({"role": "Pick admin, recruiter or interviewer."}, status=status.HTTP_400_BAD_REQUEST)
        User = get_user_model()
        user = User.objects.filter(email__iexact=email).first() if email else None
        if user is None:
            return Response(
                {"email": "No CareerBridge account uses this email. Ask them to sign up as a Company recruiter first."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.role != "company":
            return Response({"email": "That account isn't a recruiter account."}, status=status.HTTP_400_BAD_REQUEST)
        other = company_membership(user)
        if other and other.company_id != m.company_id:
            return Response({"email": f"They already work with {other.company.name} on CareerBridge."}, status=status.HTTP_400_BAD_REQUEST)
        member, created = CompanyMembership.objects.get_or_create(user=user, company=m.company, defaults={"role": role})
        if not created:
            if member.is_active:
                return Response({"email": "They're already on your team."}, status=status.HTTP_400_BAD_REQUEST)
            member.is_active, member.role = True, role
            member.save(update_fields=["is_active", "role"])

        from notifications.service import notify

        notify(
            user, "team", f"You've been added to {m.company.name}",
            f"{request.user.get_full_name() or request.user.username} added you as {member.get_role_display().lower()}.",
            "/dashboard/company", email=True,
        )
        return Response(TeamMemberSerializer(member).data, status=status.HTTP_201_CREATED)


class TeamMemberView(APIView):
    """PATCH {role, is_active} · DELETE remove (admins). The last active admin can't be demoted or removed."""

    permission_classes = [role_required("company")]

    def _member(self, request, pk):
        m = require_membership(request.user, admin=True)
        member = CompanyMembership.objects.filter(company=m.company, pk=pk).select_related("user").first()
        if member is None:
            from django.http import Http404

            raise Http404
        return m, member

    def _last_admin(self, member):
        admins = CompanyMembership.objects.filter(company=member.company, role="admin", is_active=True)
        return member.role == "admin" and member.is_active and admins.count() == 1

    def patch(self, request, pk):
        _, member = self._member(request, pk)
        role = request.data.get("role", member.role)
        active = request.data.get("is_active", member.is_active)
        if role not in CompanyMembership.Role.values:
            return Response({"role": "Pick admin, recruiter or interviewer."}, status=status.HTTP_400_BAD_REQUEST)
        if self._last_admin(member) and (role != "admin" or not active):
            return Response({"detail": "Your company needs at least one admin."}, status=status.HTTP_400_BAD_REQUEST)
        member.role, member.is_active = role, bool(active)
        member.save(update_fields=["role", "is_active"])
        return Response(TeamMemberSerializer(member).data)

    def delete(self, request, pk):
        _, member = self._member(request, pk)
        if self._last_admin(member):
            return Response({"detail": "Your company needs at least one admin."}, status=status.HTTP_400_BAD_REQUEST)
        member.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CompanyPublicView(APIView):
    """Public company page: about, culture and open roles."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        from internships.models import Internship
        from internships.serializers import InternshipListSerializer

        company = Company.objects.filter(pk=pk).first()
        if company is None:
            return Response({"detail": "Company not found."}, status=status.HTTP_404_NOT_FOUND)
        roles = Internship.objects.filter(company=company, status=Internship.Status.PUBLISHED).select_related("company")
        data = CompanySerializer(company, context={"request": request}).data
        data["open_roles"] = InternshipListSerializer(roles, many=True, context={"request": request}).data
        data["team_size"] = company.memberships.filter(is_active=True).count()
        return Response(data)
