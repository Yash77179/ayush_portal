"""Analytics views — dashboard KPIs for each role."""

from django.db.models import Count, Q
from rest_framework.decorators import api_view, permission_classes
from accounts.models import User
from accounts.permissions import role_required
from rest_framework.response import Response
from applications.models import Application
from internships.models import Internship, Skill, StudentSkill
from institutions.models import StudentProfile, Company, CompanyMembership, University


@api_view(["GET"])
@permission_classes([role_required("student")])
def student_dashboard_stats(request):
    """KPI stats for a student's dashboard."""
    try:
        profile = StudentProfile.objects.get(user=request.user)
    except StudentProfile.DoesNotExist:
        return Response({"error": "Student profile not found."}, status=404)

    apps = Application.objects.filter(student=profile)
    status_counts = apps.values("status").annotate(count=Count("status"))
    status_map = {item["status"]: item["count"] for item in status_counts}

    skills_count = profile.student_skills.count()
    recent_apps = apps.select_related("internship", "internship__company").order_by("-applied_at")[:5]

    recent_data = [
        {
            "id": a.id,
            "internship_title": a.internship.title,
            "company": a.internship.company.name,
            "status": a.status,
            "applied_at": a.applied_at,
        }
        for a in recent_apps
    ]

    return Response({
        "total_applications": apps.count(),
        "applied": status_map.get("applied", 0),
        "shortlisted": status_map.get("shortlisted", 0),
        "selected": status_map.get("selected", 0),
        "rejected": status_map.get("rejected", 0),
        "skills_count": skills_count,
        "profile_completion": profile.profile_completion,
        "recent_applications": recent_data,
        "status_breakdown": list(status_counts),
    })


@api_view(["GET"])
@permission_classes([role_required("company")])
def company_dashboard_stats(request):
    """KPI stats for a company recruiter's dashboard."""
    company_ids = CompanyMembership.objects.filter(
        user=request.user, is_active=True
    ).values_list("company_id", flat=True)

    internships = Internship.objects.filter(company_id__in=company_ids)
    apps = Application.objects.filter(internship__company_id__in=company_ids)
    status_counts = apps.values("status").annotate(count=Count("status"))
    status_map = {item["status"]: item["count"] for item in status_counts}

    recent_apps = apps.select_related(
        "student__user", "internship"
    ).order_by("-applied_at")[:5]

    recent_data = [
        {
            "id": a.id,
            "student_name": a.student.user.get_full_name(),
            "internship_title": a.internship.title,
            "status": a.status,
            "applied_at": a.applied_at,
        }
        for a in recent_apps
    ]

    return Response({
        "total_internships": internships.count(),
        "published_internships": internships.filter(status="published").count(),
        "total_applicants": apps.count(),
        "shortlisted": status_map.get("shortlisted", 0),
        "interview": status_map.get("interview", 0),
        "offered": status_map.get("offered", 0),
        "selected": status_map.get("selected", 0),
        "rejected": status_map.get("rejected", 0),
        "new": status_map.get("applied", 0),
        "recent_applications": recent_data,
        "status_breakdown": list(status_counts),
    })


@api_view(["GET"])
@permission_classes([role_required("university")])
def university_dashboard_stats(request):
    """KPI stats for a university dashboard — scoped to the officer's own university once they've linked it."""
    from institutions.access import university_staff

    staff = university_staff(request.user)
    students = StudentProfile.objects.all()
    apps = Application.objects.all()
    if staff:
        students = students.filter(university=staff.university)
        apps = apps.filter(student__university=staff.university)
    total_students = students.count()
    placed = apps.filter(status="selected").values("student").distinct().count()
    top_skills = (
        StudentSkill.objects.filter(student__in=students)
        .values("skill__name")
        .annotate(count=Count("skill"))
        .order_by("-count")[:10]
    )
    recent = apps.select_related("student__user", "internship__company").order_by("-updated_at")[:6]

    return Response({
        "university": staff.university.name if staff else None,
        "linked": bool(staff),
        "total_students": total_students,
        "verified_students": students.filter(verification_status="verified").count(),
        "pending_verification": students.filter(verification_status="unverified").count(),
        "total_published_internships": Internship.objects.filter(status="published").count(),
        "total_applications": apps.count(),
        "total_placements": placed,
        "in_interviews": apps.filter(status="interview").count(),
        "offers_pending": apps.filter(status="offered").count(),
        "verified_companies": Company.objects.filter(is_verified=True).count(),
        "placement_rate": round(placed / total_students * 100, 1) if total_students else 0,
        "top_skills": list(top_skills),
        "recent_activity": [
            {
                "id": a.id,
                "student_name": a.student.user.get_full_name() or a.student.user.username,
                "internship_title": a.internship.title,
                "company": a.internship.company.name,
                "status": a.status,
                "updated_at": a.updated_at,
            }
            for a in recent
        ],
    })


@api_view(["GET"])
@permission_classes([role_required("admin")])
def admin_dashboard_stats(request):
    """Platform-wide stats for admin."""
    return Response({
        "total_users": User.objects.count(),
        "total_students": StudentProfile.objects.count(),
        "total_companies": Company.objects.count(),
        "verified_companies": Company.objects.filter(is_verified=True).count(),
        "total_internships": Internship.objects.count(),
        "published_internships": Internship.objects.filter(status="published").count(),
        "total_applications": Application.objects.count(),
        "total_selected": Application.objects.filter(status="selected").count(),
        "total_skills": Skill.objects.count(),
    })
