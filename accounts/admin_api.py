"""Admin-only API for the site's own admin dashboard (users and companies).

Everything here reads and writes the same database as Django's /admin/ panel, so a change made in either shows up
in the other straight away. Only admins (role "admin") and superusers can call it.

Guard rails:
  - you can't deactivate yourself or take away your own admin role (you'd lock yourself out);
  - only a superuser can change another superuser;
  - verifying a company (or taking it back) tells the company's team in their notifications.
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db.models import Count, Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import role_required
from institutions.models import Company, CompanyMembership
from notifications.service import notify

User = get_user_model()
IsAdmin = role_required("admin")
ROLES = {r.value for r in User.Role}
LIMIT = 200  # rows per list; search narrows it down


def _name(u):
    return u.get_full_name() or u.username


def _photo(request, u):
    return request.build_absolute_uri(u.profile_photo.url) if u.profile_photo else None


def _org(u):
    """Where the person belongs: their company, their university, or nothing."""
    if u.role == "company":
        m = next(iter(u.company_memberships.all()), None)
        return m.company.name if m else ""
    if u.role == "student":
        p = getattr(u, "student_profile", None)
        return p.university.name if p and p.university else ""
    if u.role == "university":
        s = getattr(u, "university_staff", None)
        return s.university.name if s else ""
    return ""


def _user_row(request, u):
    return {
        "id": u.id,
        "username": u.username,
        "name": _name(u),
        "first_name": u.first_name,
        "last_name": u.last_name,
        "email": u.email,
        "role": u.role,
        "is_active": u.is_active,
        "is_superuser": u.is_superuser,
        "org": _org(u),
        "photo": _photo(request, u),
        "date_joined": u.date_joined,
        "last_login": u.last_login,
    }


def _users():
    return User.objects.select_related("student_profile__university", "university_staff__university").prefetch_related("company_memberships__company")


@api_view(["GET"])
@permission_classes([IsAdmin])
def users(request):
    """GET ?q=&role=&active=yes|no · everyone, newest first, with counts per role."""
    qs = _users().order_by("-date_joined")
    q = request.query_params.get("q", "").strip()
    if q:
        qs = qs.filter(Q(username__icontains=q) | Q(email__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q))
    role = request.query_params.get("role", "")
    if role in ROLES:
        qs = qs.filter(role=role)
    active = request.query_params.get("active", "")
    if active in ("yes", "no"):
        qs = qs.filter(is_active=active == "yes")
    total = qs.count()
    counts = dict(User.objects.values_list("role").annotate(n=Count("id")))
    return Response({
        "count": total,
        "results": [_user_row(request, u) for u in qs[:LIMIT]],
        "roles": {r: counts.get(r, 0) for r in ROLES},
        "inactive": User.objects.filter(is_active=False).count(),
    })


@api_view(["GET", "PATCH"])
@permission_classes([IsAdmin])
def user_detail(request, pk):
    """GET one person, with their memberships and activity · PATCH {first_name, last_name, email, phone, role, is_active}."""
    u = _users().filter(pk=pk).first()
    if not u:
        return Response({"detail": "No such user."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "PATCH":
        if u.is_superuser and not request.user.is_superuser:
            return Response({"detail": "Only a superuser can change another superuser."}, status=status.HTTP_403_FORBIDDEN)
        data = request.data
        if u.pk == request.user.pk:
            if data.get("is_active") is False:
                return Response({"detail": "You can't deactivate your own account."}, status=status.HTTP_400_BAD_REQUEST)
            if "role" in data and data["role"] != "admin" and not u.is_superuser:
                return Response({"detail": "You can't remove your own admin role."}, status=status.HTTP_400_BAD_REQUEST)
        if "role" in data:
            if data["role"] not in ROLES:
                return Response({"role": "Pick student, company, university or admin."}, status=status.HTTP_400_BAD_REQUEST)
            u.role = data["role"]
        if "email" in data:
            email = str(data["email"]).strip()
            if email and User.objects.filter(email__iexact=email).exclude(pk=u.pk).exists():
                return Response({"email": "Another account already uses this email."}, status=status.HTTP_400_BAD_REQUEST)
            u.email = email
        for f in ("first_name", "last_name", "phone"):
            if f in data:
                setattr(u, f, str(data[f]).strip())
        if "is_active" in data:
            u.is_active = bool(data["is_active"])
        u.save()

    memberships = [
        {"company_id": m.company_id, "company": m.company.name, "role": m.role, "is_active": m.is_active}
        for m in u.company_memberships.all()
    ]
    profile = getattr(u, "student_profile", None)
    student = None
    if profile:
        student = {
            "university": profile.university.name if profile.university else "",
            "degree": profile.degree,
            "branch": profile.branch,
            "graduation_year": profile.graduation_year,
            "applications": profile.applications.count(),
            "selected": profile.applications.filter(status="selected").count(),
        }
    staff = getattr(u, "university_staff", None)
    return Response({
        **_user_row(request, u),
        "phone": u.phone,
        "gender": u.gender,
        "profile_completed": u.profile_completed,
        "memberships": memberships,
        "student": student,
        "university_staff": staff.university.name if staff else "",
        "is_you": u.pk == request.user.pk,
    })


@api_view(["POST"])
@permission_classes([IsAdmin])
def user_set_password(request, pk):
    """POST {password} · give someone a new password (they can change it after signing in)."""
    u = User.objects.filter(pk=pk).first()
    if not u:
        return Response({"detail": "No such user."}, status=status.HTTP_404_NOT_FOUND)
    if u.is_superuser and not request.user.is_superuser:
        return Response({"detail": "Only a superuser can change another superuser."}, status=status.HTTP_403_FORBIDDEN)
    password = str(request.data.get("password", ""))
    try:
        validate_password(password, u)
    except ValidationError as e:
        return Response({"password": " ".join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)
    u.set_password(password)
    u.save(update_fields=["password"])
    return Response({"detail": "Password changed."})


# ── companies ────────────────────────────────────────────────────────────────
COMPANY_FIELDS = ("name", "website", "description", "industry", "size", "location", "culture", "linkedin_url")


def _company_row(request, c):
    return {
        "id": c.id,
        "name": c.name,
        "industry": c.industry,
        "location": c.location,
        "website": c.website,
        "size": c.size,
        "is_verified": c.is_verified,
        "logo": request.build_absolute_uri(c.logo.url) if c.logo else None,
        "created_at": c.created_at,
        "members": getattr(c, "n_members", None),
        "internships": getattr(c, "n_internships", None),
        "live": getattr(c, "n_live", None),
    }


def _companies():
    return Company.objects.annotate(
        n_members=Count("memberships", filter=Q(memberships__is_active=True), distinct=True),
        n_internships=Count("internships", distinct=True),
        n_live=Count("internships", filter=Q(internships__status="published"), distinct=True),
    )


@api_view(["GET"])
@permission_classes([IsAdmin])
def companies(request):
    """GET ?q=&verified=yes|no · every company, unverified first."""
    qs = _companies().order_by("is_verified", "-created_at")
    q = request.query_params.get("q", "").strip()
    if q:
        qs = qs.filter(Q(name__icontains=q) | Q(industry__icontains=q) | Q(location__icontains=q))
    v = request.query_params.get("verified", "")
    if v in ("yes", "no"):
        qs = qs.filter(is_verified=v == "yes")
    return Response({
        "count": qs.count(),
        "results": [_company_row(request, c) for c in qs[:LIMIT]],
        "verified": Company.objects.filter(is_verified=True).count(),
        "unverified": Company.objects.filter(is_verified=False).count(),
    })


@api_view(["GET", "PATCH"])
@permission_classes([IsAdmin])
def company_detail(request, pk):
    """GET one company, with its team and openings · PATCH {is_verified, name, website, …}."""
    c = _companies().filter(pk=pk).first()
    if not c:
        return Response({"detail": "No such company."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "PATCH":
        data = request.data
        was = c.is_verified
        for f in COMPANY_FIELDS:
            if f in data:
                setattr(c, f, str(data[f]).strip())
        if "founded_year" in data:
            y = str(data["founded_year"]).strip()
            c.founded_year = int(y) if y.isdigit() else None
        if "is_verified" in data:
            c.is_verified = bool(data["is_verified"])
        if not c.name:
            return Response({"name": "A company needs a name."}, status=status.HTTP_400_BAD_REQUEST)
        c.save()
        if c.is_verified != was:
            team = [m.user for m in c.memberships.filter(is_active=True).select_related("user")]
            if c.is_verified:
                notify(team, "verification", f"{c.name} is verified", "Students now see the verified badge on your company and your openings.", "/dashboard/company/profile")
            else:
                notify(team, "verification", f"{c.name} is no longer verified", "An admin took the verified badge off your company. Reply to support if you think this is a mistake.", "/dashboard/company/profile")
        c = _companies().get(pk=pk)

    team = [
        {"user_id": m.user_id, "name": _name(m.user), "email": m.user.email, "role": m.role, "is_active": m.is_active}
        for m in c.memberships.select_related("user").order_by("-is_active", "role")
    ]
    openings = [
        {"id": i.id, "title": i.title, "status": i.status, "applicants": i.n_apps, "created_at": i.created_at}
        for i in c.internships.annotate(n_apps=Count("applications")).order_by("-created_at")[:50]
    ]
    return Response({
        **_company_row(request, c),
        "description": c.description,
        "culture": c.culture,
        "founded_year": c.founded_year,
        "linkedin_url": c.linkedin_url,
        "team": team,
        "openings": openings,
        "sizes": dict(Company._meta.get_field("size").choices),
    })
