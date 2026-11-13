"""University placement cell: link to your university, verify students, run drives, post announcements, see reports."""

import csv
from collections import Counter, defaultdict
from statistics import median

from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import role_required
from applications.models import Application
from institutions.access import require_staff, university_staff
from institutions.models import Company, StudentProfile, University, UniversityStaff
from internships.eligibility import check_rules, internship_reasons
from internships.models import Internship
from notifications.service import notify

from .models import Announcement, DriveRegistration, PlacementDrive
from .serializers import AnnouncementSerializer, DriveSerializer, RegistrationSerializer, UniversityEditSerializer

IsUniversity = role_required("university")
IsStudent = role_required("student")
CLOSED = ("selected", "rejected")


def _uni_payload(staff, request):
    uni = staff.university
    return {
        "university": UniversityEditSerializer(uni, context={"request": request}).data,
        "is_admin": staff.is_admin,
        "title": staff.title,
        "student_count": uni.students.count(),
        "staff": [
            {"id": s.id, "name": s.user.get_full_name() or s.user.username, "email": s.user.email, "title": s.title, "is_admin": s.is_admin}
            for s in uni.staff.select_related("user")
        ],
    }


class MyUniversityView(APIView):
    """GET your university (404 until linked) · POST {university_id} or {name, location} to link · PATCH edit (admin)."""

    permission_classes = [IsUniversity]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        staff = university_staff(request.user)
        if staff is None:
            return Response({"detail": "no_university"}, status=status.HTTP_404_NOT_FOUND)
        return Response(_uni_payload(staff, request))

    def post(self, request):
        if university_staff(request.user):
            return Response({"detail": "You're already linked to a university."}, status=400)
        uni_id = request.data.get("university_id")
        if uni_id:
            uni = University.objects.filter(pk=uni_id).first()
            if uni is None:
                return Response({"university_id": "University not found."}, status=400)
        else:
            name = " ".join(str(request.data.get("name", "")).split())
            if len(name) < 2:
                return Response({"name": "Pick your university or type its name."}, status=400)
            uni = University.objects.filter(name__iexact=name).first() or University.objects.create(
                name=name[:200], location=str(request.data.get("location", ""))[:200]
            )
        with transaction.atomic():
            first = not uni.staff.exists()
            staff = UniversityStaff.objects.create(
                user=request.user, university=uni, is_admin=first, title=str(request.data.get("title", ""))[:100]
            )
        if not first:
            notify([s.user for s in uni.staff.filter(is_admin=True).select_related("user")], "team",
                   f"{request.user.get_full_name() or request.user.username} joined your placement cell", uni.name,
                   "/dashboard/university/settings")
        return Response(_uni_payload(staff, request), status=201)

    def patch(self, request):
        staff = require_staff(request.user, admin=True)
        if "title" in request.data:
            staff.title = str(request.data["title"])[:100]
            staff.save(update_fields=["title"])
        data = {k: v for k, v in request.data.items() if k in ("location", "website", "established_year", "logo", "name")}
        if data:
            s = UniversityEditSerializer(staff.university, data=data, partial=True)
            s.is_valid(raise_exception=True)
            s.save()
        return Response(_uni_payload(staff, request))


@api_view(["PATCH", "DELETE"])
@permission_classes([IsUniversity])
def staff_member(request, pk):
    """Admin: PATCH {is_admin} or DELETE a colleague. The last admin stays."""
    me = require_staff(request.user, admin=True)
    member = get_object_or_404(UniversityStaff, pk=pk, university=me.university)
    admins = me.university.staff.filter(is_admin=True).count()
    if request.method == "DELETE":
        if member.is_admin and admins == 1:
            return Response({"detail": "Your placement cell needs at least one admin."}, status=400)
        member.delete()
        return Response(status=204)
    make_admin = bool(request.data.get("is_admin"))
    if member.is_admin and not make_admin and admins == 1:
        return Response({"detail": "Your placement cell needs at least one admin."}, status=400)
    member.is_admin = make_admin
    member.save(update_fields=["is_admin"])
    return Response({"id": member.id, "is_admin": member.is_admin})


# ── Students ────────────────────────────────────────────────────────────────

def _student_row(p, apps):
    statuses = [a.status for a in apps]
    return {
        "id": p.id,
        "name": p.user.get_full_name() or p.user.username,
        "email": p.user.email,
        "enrollment_number": p.enrollment_number,
        "degree": p.degree,
        "branch": p.branch,
        "graduation_year": p.graduation_year,
        "cgpa": p.cgpa,
        "verification_status": p.verification_status,
        "verification_note": p.verification_note,
        "profile_completion": p.profile_completion,
        "skills": len(p.student_skills.all()),
        "applications": len(apps),
        "active": sum(1 for s in statuses if s not in CLOSED),
        "offers": sum(1 for s in statuses if s == "offered"),
        "placed": "selected" in statuses,
    }


def _students(staff):
    return (
        StudentProfile.objects.filter(university=staff.university)
        .select_related("user")
        .prefetch_related("student_skills", "applications")
        .order_by("user__first_name", "user__last_name")
    )


@api_view(["GET"])
@permission_classes([IsUniversity])
def student_list(request):
    """?q= &branch= &year= &verification= &placed=yes|no"""
    staff = require_staff(request.user)
    qs = _students(staff)
    p = request.query_params
    if p.get("q"):
        q = p["q"]
        qs = qs.filter(Q(user__first_name__icontains=q) | Q(user__last_name__icontains=q) | Q(user__email__icontains=q)
                       | Q(enrollment_number__icontains=q))
    if p.get("branch"):
        qs = qs.filter(branch__iexact=p["branch"])
    if p.get("year") and p["year"].isdigit():
        qs = qs.filter(graduation_year=int(p["year"]))
    if p.get("verification"):
        qs = qs.filter(verification_status=p["verification"])
    rows = [_student_row(s, list(s.applications.all())) for s in qs]
    if p.get("placed") in ("yes", "no"):
        rows = [r for r in rows if r["placed"] == (p["placed"] == "yes")]
    branches = sorted({b for b in StudentProfile.objects.filter(university=staff.university).values_list("branch", flat=True) if b})
    return Response({"results": rows, "branches": branches})


@api_view(["GET"])
@permission_classes([IsUniversity])
def student_detail(request, pk):
    staff = require_staff(request.user)
    p = get_object_or_404(_students(staff).prefetch_related("student_skills__skill"), pk=pk)
    apps = list(p.applications.select_related("internship__company").order_by("-applied_at"))
    data = _student_row(p, apps)
    data.update({
        "phone": p.user.phone,
        "bio": p.bio,
        "linkedin_url": p.linkedin_url,
        "github_url": p.github_url,
        "resume": request.build_absolute_uri(p.resume_file.url) if p.resume_file else (p.resume_url or None),
        "skill_list": [{"name": s.skill.name, "proficiency": s.proficiency} for s in p.student_skills.all()],
        "application_list": [
            {"id": a.id, "internship": a.internship.title, "company": a.internship.company.name, "status": a.status,
             "applied_at": a.applied_at, "stipend": a.internship.stipend}
            for a in apps
        ],
        "drives": [
            {"id": r.drive_id, "title": r.drive.title, "date": r.drive.drive_date, "attended": r.attended, "outcome": r.outcome}
            for r in p.drive_registrations.select_related("drive")
        ],
    })
    return Response(data)


@api_view(["POST"])
@permission_classes([IsUniversity])
def verify_student(request, pk):
    """{"status": "verified" | "rejected" | "unverified", "note": "..."}; optionally fixes enrollment_number / cgpa."""
    staff = require_staff(request.user)
    p = get_object_or_404(StudentProfile.objects.select_related("user"), pk=pk, university=staff.university)
    new = request.data.get("status")
    if new not in StudentProfile.Verification.values:
        return Response({"status": "Pick verified, rejected or unverified."}, status=400)
    note = str(request.data.get("note", ""))[:300]
    if new == "rejected" and not note:
        return Response({"note": "Tell the student what's wrong so they can fix it."}, status=400)
    if "enrollment_number" in request.data:
        p.enrollment_number = str(request.data["enrollment_number"])[:50]
    if request.data.get("cgpa") not in (None, ""):
        try:
            from decimal import Decimal

            cgpa = Decimal(str(request.data["cgpa"]))
            if not 0 <= cgpa <= 10:
                raise ValueError
            p.cgpa = cgpa
        except Exception:
            return Response({"cgpa": "CGPA is on a 0–10 scale."}, status=400)
    p.verification_status, p.verification_note = new, note
    p.verified_at = timezone.now() if new == "verified" else None
    p.verified_by = request.user if new != "unverified" else None
    p.save()
    if new != "unverified":
        title = "Your profile is verified ✓" if new == "verified" else "Your profile needs a fix"
        body = f"{staff.university.name} verified your enrolment and grades." if new == "verified" else note
        notify(p.user, "verification", title, body, "/dashboard/student/profile", email=new == "rejected")
    return Response(_student_row(p, list(p.applications.all())))


@api_view(["POST"])
@permission_classes([IsUniversity])
def verify_bulk(request):
    staff = require_staff(request.user)
    ids = [int(i) for i in request.data.get("ids", []) if str(i).isdigit()]
    profiles = StudentProfile.objects.filter(university=staff.university, pk__in=ids).select_related("user")
    n = 0
    for p in profiles:
        if p.verification_status != "verified":
            p.verification_status, p.verification_note = "verified", ""
            p.verified_at, p.verified_by = timezone.now(), request.user
            p.save(update_fields=["verification_status", "verification_note", "verified_at", "verified_by"])
            notify(p.user, "verification", "Your profile is verified ✓", f"{staff.university.name} verified your enrolment and grades.",
                   "/dashboard/student/profile")
            n += 1
    return Response({"verified": n})


# ── Drives ──────────────────────────────────────────────────────────────────

def _drive_reasons(profile, drive):
    reasons = check_rules(profile, min_cgpa=drive.min_cgpa, branches=drive.allowed_branches,
                          year_min=drive.graduation_year, year_max=drive.graduation_year)
    if drive.internship_id:
        reasons += [r for r in internship_reasons(profile, drive.internship) if r not in reasons]
    return reasons


def _eligible_students(drive):
    profiles = StudentProfile.objects.filter(university=drive.university).select_related("user")
    return [p for p in profiles if not _drive_reasons(p, drive)]


class DriveListView(generics.ListCreateAPIView):
    serializer_class = DriveSerializer
    permission_classes = [IsUniversity]
    pagination_class = None

    def get_queryset(self):
        staff = require_staff(self.request.user)
        return (PlacementDrive.objects.filter(university=staff.university)
                .select_related("company", "internship").annotate(registrations_count=Count("registrations")))

    def list(self, request, *args, **kwargs):
        rows = self.get_serializer(self.get_queryset(), many=True).data
        for row, drive in zip(rows, self.get_queryset()):
            row["eligible_count"] = len(_eligible_students(drive))
        return Response(rows)

    def perform_create(self, serializer):
        staff = require_staff(self.request.user)
        drive = serializer.save(university=staff.university, created_by=self.request.user)
        when = timezone.localtime(drive.drive_date).strftime("%d %b, %I:%M %p")
        notify([p.user for p in _eligible_students(drive)], "drive", f"New campus drive: {drive.display_company}",
               f"{drive.title} · {when}. You're eligible — register from Campus.", "/dashboard/student/campus")
        if drive.company:
            team = [m.user for m in drive.company.memberships.filter(is_active=True).select_related("user")]
            notify(team, "drive", f"{staff.university.name} scheduled a campus drive with you", f"{drive.title} · {when}",
                   "/dashboard/company")


class DriveDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = DriveSerializer
    permission_classes = [IsUniversity]

    def get_queryset(self):
        staff = require_staff(self.request.user)
        return (PlacementDrive.objects.filter(university=staff.university)
                .select_related("company", "internship").annotate(registrations_count=Count("registrations")))

    def retrieve(self, request, *args, **kwargs):
        drive = self.get_object()
        data = self.get_serializer(drive).data
        data["registrations"] = RegistrationSerializer(
            drive.registrations.select_related("student__user"), many=True
        ).data
        data["eligible_count"] = len(_eligible_students(drive))
        return Response(data)

    def perform_update(self, serializer):
        old = serializer.instance.status
        drive = serializer.save()
        if drive.status == "cancelled" and old != "cancelled":
            students = [r.student.user for r in drive.registrations.select_related("student__user")]
            notify(students, "drive", f"Drive cancelled: {drive.display_company}", drive.title, "/dashboard/student/campus", email=True)


@api_view(["PATCH"])
@permission_classes([IsUniversity])
def update_registration(request, drive_id, pk):
    """{"attended": bool, "outcome": "pending" | "selected" | "not_selected"}"""
    staff = require_staff(request.user)
    reg = get_object_or_404(DriveRegistration.objects.select_related("student__user", "drive"),
                            pk=pk, drive_id=drive_id, drive__university=staff.university)
    if "attended" in request.data:
        reg.attended = bool(request.data["attended"])
    outcome = request.data.get("outcome")
    if outcome:
        if outcome not in DriveRegistration.Outcome.values:
            return Response({"outcome": "Unknown outcome."}, status=400)
        if outcome != reg.outcome and outcome == "selected":
            notify(reg.student.user, "drive", f"Selected at {reg.drive.display_company}! 🎉", reg.drive.title, "/dashboard/student/campus", email=True)
        reg.outcome = outcome
    reg.save()
    return Response(RegistrationSerializer(reg).data)


@api_view(["GET"])
@permission_classes([IsUniversity])
def drive_options(request):
    """Companies and their open internships, for linking a drive."""
    require_staff(request.user)
    companies = Company.objects.order_by("name")
    roles = defaultdict(list)
    for i in Internship.objects.filter(status="published").values("id", "title", "company_id"):
        roles[i["company_id"]].append({"id": i["id"], "title": i["title"]})
    return Response([{"id": c.id, "name": c.name, "is_verified": c.is_verified, "internships": roles.get(c.id, [])} for c in companies])


# ── Announcements ───────────────────────────────────────────────────────────

class AnnouncementListView(generics.ListCreateAPIView):
    serializer_class = AnnouncementSerializer
    permission_classes = [IsUniversity]
    pagination_class = None

    def get_queryset(self):
        return Announcement.objects.filter(university=require_staff(self.request.user).university).select_related("author")

    def perform_create(self, serializer):
        staff = require_staff(self.request.user)
        a = serializer.save(university=staff.university, author=self.request.user)
        students = [p.user for p in StudentProfile.objects.filter(university=staff.university).select_related("user")]
        notify(students, "announcement", a.title, a.body[:200], "/dashboard/student/campus")


class AnnouncementDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AnnouncementSerializer
    permission_classes = [IsUniversity]

    def get_queryset(self):
        return Announcement.objects.filter(university=require_staff(self.request.user).university)


# ── Reports ─────────────────────────────────────────────────────────────────

def _report(staff):
    profiles = list(_students(staff).select_related("university"))
    apps = list(Application.objects.filter(student__university=staff.university).select_related("internship__company", "student"))
    by_student = defaultdict(list)
    for a in apps:
        by_student[a.student_id].append(a)
    placed_ids = {a.student_id for a in apps if a.status == "selected"}
    hires = [a for a in apps if a.status == "selected"]
    stipends = sorted(float(a.internship.stipend) for a in hires)

    branch = defaultdict(lambda: {"students": 0, "placed": 0, "applied": 0})
    year = defaultdict(lambda: {"students": 0, "placed": 0})
    for p in profiles:
        b = branch[p.branch or "Not set"]
        b["students"] += 1
        b["placed"] += p.id in placed_ids
        b["applied"] += bool(by_student[p.id])
        y = year[p.graduation_year or "Not set"]
        y["students"] += 1
        y["placed"] += p.id in placed_ids

    total = len(profiles)
    status_counts = Counter(a.status for a in apps)
    drives = PlacementDrive.objects.filter(university=staff.university).annotate(n=Count("registrations"))
    return {
        "university": staff.university.name,
        "generated_at": timezone.now(),
        "total_students": total,
        "verified_students": sum(1 for p in profiles if p.verification_status == "verified"),
        "students_applied": sum(1 for p in profiles if by_student[p.id]),
        "students_placed": len(placed_ids),
        "placement_rate": round(len(placed_ids) / total * 100, 1) if total else 0,
        "total_applications": len(apps),
        "offers_pending": status_counts.get("offered", 0),
        "in_interviews": status_counts.get("interview", 0),
        "stipend": {
            "median": median(stipends) if stipends else None,
            "highest": stipends[-1] if stipends else None,
            "average": round(sum(stipends) / len(stipends)) if stipends else None,
        },
        "top_recruiters": [{"company": c, "hires": n} for c, n in Counter(a.internship.company.name for a in hires).most_common(8)],
        "branches": sorted(
            [{"branch": k, **v, "rate": round(v["placed"] / v["students"] * 100, 1) if v["students"] else 0} for k, v in branch.items()],
            key=lambda r: -r["students"],
        ),
        "years": sorted([{"year": str(k), **v} for k, v in year.items()], key=lambda r: r["year"]),
        "pipeline": [{"status": s, "count": status_counts.get(s, 0)} for s in
                     ["applied", "review", "shortlisted", "interview", "offered", "selected", "rejected"]],
        "drives": {
            "total": drives.count(),
            "upcoming": drives.filter(status="upcoming", drive_date__gte=timezone.now()).count(),
            "registrations": sum(d.n for d in drives),
            "selected": DriveRegistration.objects.filter(drive__university=staff.university, outcome="selected").count(),
        },
        "top_skills": [
            {"skill": name, "count": n} for name, n in Counter(
                ss.skill.name for p in profiles for ss in p.student_skills.select_related("skill")
            ).most_common(10)
        ],
    }


@api_view(["GET"])
@permission_classes([IsUniversity])
def placement_report(request):
    return Response(_report(require_staff(request.user)))


@api_view(["GET"])
@permission_classes([IsUniversity])
def report_csv(request):
    """Student-wise placement report."""
    staff = require_staff(request.user)
    res = HttpResponse(content_type="text/csv; charset=utf-8")
    res["Content-Disposition"] = 'attachment; filename="placement-report.csv"'
    res.write("﻿")
    w = csv.writer(res)
    w.writerow(["Name", "Email", "Enrollment no.", "Degree", "Branch", "Graduation year", "CGPA", "Verified",
                "Applications", "Active", "Placed", "Placed at", "Stipend (₹/mo)"])
    for p in _students(staff).prefetch_related("applications__internship__company"):
        apps = list(p.applications.all())
        hire = next((a for a in apps if a.status == "selected"), None)
        w.writerow([
            p.user.get_full_name() or p.user.username, p.user.email, p.enrollment_number, p.degree, p.branch,
            p.graduation_year or "", p.cgpa or "", "yes" if p.verification_status == "verified" else "no",
            len(apps), sum(1 for a in apps if a.status not in CLOSED), "yes" if hire else "no",
            hire.internship.company.name if hire else "", f"{hire.internship.stipend:.0f}" if hire else "",
        ])
    return res


# ── Student side ────────────────────────────────────────────────────────────

def _my_profile(user):
    p = StudentProfile.objects.filter(user=user).select_related("university").first()
    if p is None or p.university_id is None:
        return None
    return p


@api_view(["GET"])
@permission_classes([IsStudent])
def student_campus(request):
    """Drives and announcements from the student's university."""
    p = _my_profile(request.user)
    if p is None:
        return Response({"university": None, "drives": [], "announcements": []})
    mine = set(DriveRegistration.objects.filter(student=p).values_list("drive_id", flat=True))
    outcomes = dict(DriveRegistration.objects.filter(student=p).values_list("drive_id", "outcome"))
    drives = (PlacementDrive.objects.filter(university=p.university).exclude(status="cancelled")
              .select_related("company", "internship").annotate(registrations_count=Count("registrations")))
    rows = []
    today = timezone.localdate()
    for d in drives:
        row = DriveSerializer(d).data
        reasons = _drive_reasons(p, d)
        row.update({
            "registered": d.id in mine,
            "outcome": outcomes.get(d.id),
            "eligible": not reasons,
            "reasons": reasons,
            "registration_open": d.status == "upcoming" and (d.registration_deadline is None or d.registration_deadline >= today),
        })
        rows.append(row)
    return Response({
        "university": {"id": p.university.id, "name": p.university.name},
        "verification_status": p.verification_status,
        "verification_note": p.verification_note,
        "drives": rows,
        "announcements": AnnouncementSerializer(Announcement.objects.filter(university=p.university).select_related("author")[:30], many=True).data,
    })


@api_view(["POST", "DELETE"])
@permission_classes([IsStudent])
def drive_register(request, pk):
    p = _my_profile(request.user)
    if p is None:
        return Response({"detail": "Add your university to your profile first."}, status=400)
    drive = get_object_or_404(PlacementDrive.objects.select_related("internship__company"), pk=pk, university=p.university)
    if request.method == "DELETE":
        reg = DriveRegistration.objects.filter(drive=drive, student=p).first()
        if reg is None:
            return Response(status=204)
        if drive.status != "upcoming":
            return Response({"detail": "The drive has already started."}, status=400)
        reg.delete()
        return Response(status=204)

    if drive.status != "upcoming" or (drive.registration_deadline and drive.registration_deadline < timezone.localdate()):
        return Response({"detail": "Registration for this drive is closed."}, status=400)
    reasons = _drive_reasons(p, drive)
    if reasons:
        return Response({"eligibility": reasons}, status=400)
    try:
        DriveRegistration.objects.create(drive=drive, student=p)
    except IntegrityError:
        return Response({"detail": "You're already registered."}, status=400)

    applied, needs_questions = False, False
    i = drive.internship
    if i and i.status == "published" and not Application.objects.filter(student=p, internship=i).exists():
        if i.screening_questions.filter(required=True).exists():
            needs_questions = True
        else:
            from applications.services import on_new_application

            app = Application.objects.create(student=p, internship=i, source=Application.Source.DRIVE)
            on_new_application(app)
            applied = True
    return Response({"registered": True, "applied": applied, "needs_questions": needs_questions,
                     "internship_id": i.id if i else None}, status=201)
