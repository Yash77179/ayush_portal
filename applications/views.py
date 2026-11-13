"""Views for applications app: students applying and following up, and the recruiter hiring system (ATS)."""

import csv
from collections import Counter, defaultdict
from datetime import timedelta
from statistics import mean

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from accounts.permissions import role_required
from institutions.access import company_membership, require_membership
from institutions.models import StudentProfile
from internships.eligibility import clean_answers, internship_reasons
from internships.models import Internship

from . import services
from .models import (
    Application,
    ApplicationEvent,
    ApplicationNote,
    ApplicationRating,
    EmailTemplate,
    Interview,
    InterviewFeedback,
    Offer,
)
from .serializers import (
    ApplicationSerializer,
    EmailTemplateSerializer,
    FeedbackSerializer,
    InterviewSerializer,
    NoteSerializer,
    OfferSerializer,
    RecruiterApplicationDetailSerializer,
    RecruiterApplicationRowSerializer,
    StudentApplicationDetailSerializer,
    match_for,
)

STAGES = ["applied", "review", "shortlisted", "interview", "offered", "selected"]
IsRecruiter = role_required("company")


def _student_profile(user):
    profile = StudentProfile.objects.filter(user=user).first()
    if profile is None:
        raise ValidationError("Please complete your student profile first.")
    return profile


def _student_qs(profile):
    return (
        Application.objects.filter(student=profile)
        .select_related("internship", "internship__company", "offer")
        .prefetch_related("interviews", "events")
    )


# ── Student ─────────────────────────────────────────────────────────────────

class StudentApplicationListCreateView(generics.ListCreateAPIView):
    """Student: view their applications (with interviews and offers) and submit a new one."""
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        profile = StudentProfile.objects.filter(user=self.request.user).first()
        return _student_qs(profile) if profile else Application.objects.none()

    def perform_create(self, serializer):
        profile = _student_profile(self.request.user)
        internship = serializer.validated_data["internship"]
        if internship.status != Internship.Status.PUBLISHED:
            raise ValidationError("This internship is not accepting applications.")
        if internship.deadline < timezone.localdate():
            raise ValidationError("The deadline for this internship has passed.")
        reasons = internship_reasons(profile, internship)
        if reasons:
            raise ValidationError({"eligibility": reasons})
        answers, errors, knocked = clean_answers(internship, serializer.validated_data.pop("answers", []))
        if errors:
            raise ValidationError({"answers": errors})
        try:
            with transaction.atomic():
                app = serializer.save(student=profile, answers=answers)
        except IntegrityError:
            raise ValidationError("You have already applied for this internship.")
        services.on_new_application(app)
        if knocked:
            # Knockout questions: the application is closed straight away; the student hears the usual kind message later.
            app.status, app.status_changed_at = Application.Status.REJECTED, timezone.now()
            app.save(update_fields=["status", "status_changed_at"])
            services.log(app, ApplicationEvent.Kind.KNOCKOUT, detail="Screening: " + "; ".join(knocked), from_status="applied", to_status="rejected")


class StudentApplicationDetailView(generics.RetrieveAPIView):
    serializer_class = StudentApplicationDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return _student_qs(_student_profile(self.request.user))


class ApplicationWithdrawView(generics.DestroyAPIView):
    """Student: withdraw an application that nobody has acted on beyond screening."""
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        profile = _student_profile(self.request.user)
        return Application.objects.filter(student=profile, status__in=[Application.Status.APPLIED, Application.Status.REVIEW])


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def interview_respond(request, pk):
    """Student: {"response": "confirmed" | "reschedule", "note": "..."}."""
    interview = get_object_or_404(
        Interview.objects.select_related("application__student__user", "application__internship__company"),
        pk=pk, application__student__user=request.user,
    )
    response = request.data.get("response")
    if response not in ("confirmed", "reschedule"):
        return Response({"response": "Confirm, or ask to reschedule."}, status=400)
    if interview.status != "scheduled":
        return Response({"detail": "This interview is no longer scheduled."}, status=400)
    note = str(request.data.get("note", ""))[:500]
    if response == "reschedule" and not note:
        return Response({"note": "Tell them which times work for you."}, status=400)
    interview.candidate_response, interview.candidate_note = response, note
    interview.save(update_fields=["candidate_response", "candidate_note"])
    app = interview.application
    name = request.user.get_full_name() or request.user.username
    text = "confirmed" if response == "confirmed" else "asked to reschedule"
    services.log(app, ApplicationEvent.Kind.INTERVIEW, request.user, detail=f"Candidate {text}" + (f": {note}" if note else ""))
    from notifications.service import notify

    notify(
        services.team_users(app.internship.company, managers_only=True) + list(interview.interviewers.all()),
        "interview", f"{name} {text}", f"{interview.round_name} · {app.internship.title}" + (f" — “{note}”" if note else ""),
        services.candidate_link(app), email=response == "reschedule",
    )
    return Response({"candidate_response": response, "candidate_note": note})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def interview_ics(request, pk):
    """The calendar invite, for the candidate or anyone on the hiring company's team."""
    interview = get_object_or_404(Interview.objects.select_related("application__internship__company", "application__student__user"), pk=pk)
    app = interview.application
    m = company_membership(request.user)
    if app.student.user_id != request.user.id and not (m and m.company_id == app.internship.company_id):
        raise PermissionDenied()
    res = HttpResponse(services.interview_ics(interview), content_type="text/calendar; charset=utf-8")
    res["Content-Disposition"] = f'attachment; filename="interview-{interview.pk}.ics"'
    return res


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def offer_detail(request, pk):
    """For the offer letter page: the candidate or the hiring company."""
    offer = get_object_or_404(Offer.objects.select_related("application__internship__company", "application__student__user", "sent_by"), pk=pk)
    app = offer.application
    m = company_membership(request.user)
    if app.student.user_id != request.user.id and not (m and m.company_id == app.internship.company_id):
        raise PermissionDenied()
    data = OfferSerializer(offer).data
    company = app.internship.company
    data.update({
        "company": {"name": company.name, "location": company.location, "website": company.website,
                    "logo": request.build_absolute_uri(company.logo.url) if company.logo else None},
        "candidate_email": app.student.user.email,
        "signed_by": (offer.sent_by.get_full_name() or offer.sent_by.username) if offer.sent_by else company.name,
        "internship_title": app.internship.title,
    })
    return Response(data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def offer_respond(request, pk):
    """Student: {"decision": "accept" | "decline", "note": "..."}."""
    offer = get_object_or_404(Offer.objects.select_related("application__student__user", "application__internship__company"),
                              pk=pk, application__student__user=request.user)
    decision = request.data.get("decision")
    if decision not in ("accept", "decline"):
        return Response({"decision": "Accept or decline."}, status=400)
    if offer.status != "pending":
        return Response({"detail": f"This offer is already {offer.status}."}, status=400)
    if offer.is_expired:
        return Response({"detail": "This offer has expired. Contact the company if you're still interested."}, status=400)
    services.respond_to_offer(offer, decision == "accept", str(request.data.get("note", "")))
    return Response(OfferSerializer(offer).data)


# ── Recruiter: lists and one candidate ──────────────────────────────────────

def recruiter_qs(company):
    return (
        Application.objects.filter(internship__company=company)
        .select_related("student__user", "student__university", "internship__company", "offer")
        .prefetch_related("ratings", "interviews", "student__student_skills__skill", "internship__internship_skills__skill")
    )


def _company_app(request, pk, *, manage=False):
    m = require_membership(request.user, manage=manage)
    return m, get_object_or_404(recruiter_qs(m.company), pk=pk)


def _filtered(request, company):
    qs = recruiter_qs(company)
    p = request.query_params
    if p.get("internship"):
        qs = qs.filter(internship_id=p["internship"])
    if p.get("status"):
        qs = qs.filter(status__in=p["status"].split(","))
    if p.get("source"):
        qs = qs.filter(source=p["source"])
    if p.get("q"):
        q = p["q"]
        qs = qs.filter(
            Q(student__user__first_name__icontains=q) | Q(student__user__last_name__icontains=q)
            | Q(student__user__email__icontains=q) | Q(student__university__name__icontains=q)
        )
    rows = list(qs)
    if p.get("tag"):
        rows = [a for a in rows if p["tag"] in (a.tags or [])]
    return rows


class RecruiterApplicationListView(generics.ListAPIView):
    """Recruiter: every applicant for the company (filters: internship, status, source, tag, q)."""
    serializer_class = RecruiterApplicationRowSerializer
    permission_classes = [IsRecruiter]
    pagination_class = None

    def get_queryset(self):
        m = company_membership(self.request.user)
        return _filtered(self.request, m.company) if m else []


class RecruiterApplicationDetailView(generics.RetrieveAPIView):
    serializer_class = RecruiterApplicationDetailSerializer
    permission_classes = [IsRecruiter]

    def get_object(self):
        m = require_membership(self.request.user)
        app = get_object_or_404(
            recruiter_qs(m.company).prefetch_related(
                "notes__author", "ratings__author", "events__actor", "interviews__interviewers", "interviews__feedback__author",
                "student__experiences", "student__certifications", "student__achievements",
            ),
            pk=self.kwargs["pk"],
        )
        if app.viewed_at is None:
            app.viewed_at = timezone.now()
            app.save(update_fields=["viewed_at"])
            services.log(app, ApplicationEvent.Kind.VIEWED, self.request.user)
        return app


class RecruiterApplicationStatusUpdateView(generics.UpdateAPIView):
    """Recruiter: move to a stage (logged, student told by email) and/or edit the quick notes."""
    permission_classes = [IsRecruiter]

    def update(self, request, *args, **kwargs):
        _, app = _company_app(request, kwargs["pk"], manage=True)
        new = request.data.get("status")
        if new and new not in Application.Status.values:
            return Response({"status": "Unknown stage."}, status=400)
        if "recruiter_notes" in request.data and request.data["recruiter_notes"] is not None:
            app.recruiter_notes = str(request.data["recruiter_notes"])
            app.save(update_fields=["recruiter_notes", "updated_at"])
        if new:
            services.move(app, new, request.user, notify_student=request.data.get("notify", True) is not False)
        return Response(RecruiterApplicationRowSerializer(app, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsRecruiter])
def add_note(request, pk):
    _, app = _company_app(request, pk)
    body = str(request.data.get("body", "")).strip()
    if not body:
        return Response({"body": "Write something first."}, status=400)
    note = ApplicationNote.objects.create(application=app, author=request.user, body=body[:5000])
    services.log(app, ApplicationEvent.Kind.NOTE, request.user, detail=body[:120])
    return Response(NoteSerializer(note).data, status=201)


@api_view(["DELETE"])
@permission_classes([IsRecruiter])
def delete_note(request, pk):
    m = require_membership(request.user)
    note = get_object_or_404(ApplicationNote, pk=pk, application__internship__company=m.company)
    if note.author_id != request.user.id and m.role != "admin":
        raise PermissionDenied("You can only delete your own notes.")
    note.delete()
    return Response(status=204)


@api_view(["PUT"])
@permission_classes([IsRecruiter])
def set_rating(request, pk):
    _, app = _company_app(request, pk)
    try:
        stars = int(request.data.get("stars"))
    except (TypeError, ValueError):
        stars = 0
    if stars == 0:
        ApplicationRating.objects.filter(application=app, author=request.user).delete()
    elif 1 <= stars <= 5:
        ApplicationRating.objects.update_or_create(application=app, author=request.user, defaults={"stars": stars})
        services.log(app, ApplicationEvent.Kind.RATED, request.user, detail=f"{stars}★")
    else:
        return Response({"stars": "From 1 to 5 (0 clears your rating)."}, status=400)
    stars_all = list(app.ratings.values_list("stars", flat=True))
    return Response({"my_rating": stars or None, "avg_rating": round(mean(stars_all), 1) if stars_all else None})


def _clean_tags(raw):
    tags = []
    for t in raw if isinstance(raw, list) else []:
        t = " ".join(str(t).split())[:40]
        if t and t.lower() not in {x.lower() for x in tags}:
            tags.append(t)
    return tags[:15]


@api_view(["PUT"])
@permission_classes([IsRecruiter])
def set_tags(request, pk):
    _, app = _company_app(request, pk)
    app.tags = _clean_tags(request.data.get("tags"))
    app.save(update_fields=["tags"])
    services.log(app, ApplicationEvent.Kind.TAGGED, request.user, detail=", ".join(app.tags) or "cleared")
    return Response({"tags": app.tags})


@api_view(["POST"])
@permission_classes([IsRecruiter])
def email_candidate(request, pk):
    _, app = _company_app(request, pk, manage=True)
    subject, body = str(request.data.get("subject", "")).strip(), str(request.data.get("body", "")).strip()
    if not subject or not body:
        return Response({"detail": "Add a subject and a message."}, status=400)
    sent = services.send_candidate_email(app, subject, body, request.user)
    return Response({"sent": sent})


# ── Interviews ──────────────────────────────────────────────────────────────

def _check_panel(company, ids):
    members = {m.user_id: m.user for m in company.memberships.filter(is_active=True).select_related("user")}
    bad = [i for i in ids if i not in members]
    if bad:
        raise ValidationError({"interviewer_ids": "Interviewers must be on your company team."})
    return [members[i] for i in ids]


@api_view(["POST"])
@permission_classes([IsRecruiter])
def schedule_interview(request, pk):
    m, app = _company_app(request, pk, manage=True)
    if app.status in ("rejected", "selected"):
        return Response({"detail": "This application is closed."}, status=400)
    serializer = InterviewSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    if serializer.validated_data["scheduled_at"] < timezone.now():
        return Response({"scheduled_at": "Pick a time in the future."}, status=400)
    panel = _check_panel(m.company, serializer.validated_data.pop("interviewer_ids", []))
    interview = serializer.save(application=app, created_by=request.user)
    interview.interviewers.set(panel)
    if app.status in ("applied", "review", "shortlisted"):
        services.move(app, "interview", request.user, notify_student=False)
    services.announce_interview(interview, request.user)
    return Response(InterviewSerializer(interview).data, status=201)


@api_view(["GET"])
@permission_classes([IsRecruiter])
def company_interviews(request):
    """?scope=upcoming (default) | past | mine | all"""
    m = require_membership(request.user)
    qs = (
        Interview.objects.filter(application__internship__company=m.company)
        .select_related("application__student__user", "application__internship")
        .prefetch_related("interviewers", "feedback__author")
    )
    scope = request.query_params.get("scope", "upcoming")
    now = timezone.now()
    if scope == "upcoming":
        qs = qs.filter(scheduled_at__gte=now - timedelta(hours=2), status="scheduled")
    elif scope == "past":
        qs = qs.filter(Q(scheduled_at__lt=now) | ~Q(status="scheduled")).order_by("-scheduled_at")
    elif scope == "mine":
        qs = qs.filter(interviewers=request.user, status="scheduled")
    return Response(InterviewSerializer(qs[:200], many=True).data)


@api_view(["PATCH"])
@permission_classes([IsRecruiter])
def update_interview(request, pk):
    """Reschedule / edit (re-sends the invite), mark completed, or cancel ({"status": "cancelled"})."""
    m = require_membership(request.user, manage=True)
    interview = get_object_or_404(Interview.objects.select_related("application__internship__company", "application__student__user"),
                                  pk=pk, application__internship__company=m.company)
    new_status = request.data.get("status")
    if new_status == "cancelled":
        services.cancel_interview(interview, request.user)
        return Response(InterviewSerializer(interview).data)
    serializer = InterviewSerializer(interview, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    ids = serializer.validated_data.pop("interviewer_ids", None)
    timing_changed = any(
        k in serializer.validated_data and serializer.validated_data[k] != getattr(interview, k)
        for k in ("scheduled_at", "duration_minutes", "mode", "meeting_link", "location")
    )
    interview = serializer.save()
    if ids is not None:
        interview.interviewers.set(_check_panel(m.company, ids))
    if timing_changed and interview.status == "scheduled":
        interview.candidate_response, interview.candidate_note = "pending", ""
        interview.save(update_fields=["candidate_response", "candidate_note"])
        services.announce_interview(interview, request.user, updated=True)
    elif new_status == "completed":
        services.log(interview.application, ApplicationEvent.Kind.INTERVIEW, request.user, detail=f"{interview.round_name} completed")
    return Response(InterviewSerializer(interview).data)


@api_view(["POST"])
@permission_classes([IsRecruiter])
def interview_feedback(request, pk):
    """Any team member can submit (or update) their own scorecard."""
    m = require_membership(request.user)
    interview = get_object_or_404(Interview, pk=pk, application__internship__company=m.company)
    existing = InterviewFeedback.objects.filter(interview=interview, author=request.user).first()
    serializer = FeedbackSerializer(existing, data=request.data, partial=existing is not None)
    serializer.is_valid(raise_exception=True)
    if existing is None:
        missing = [f for f in ("technical", "communication", "culture", "recommendation") if f not in serializer.validated_data]
        if missing:
            return Response({f: "Required." for f in missing}, status=400)
    fb = serializer.save(interview=interview, author=request.user)
    services.log(interview.application, ApplicationEvent.Kind.FEEDBACK, request.user,
                 detail=f"{interview.round_name}: {fb.get_recommendation_display()}")
    return Response(FeedbackSerializer(fb).data, status=201 if existing is None else 200)


# ── Offers ──────────────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsRecruiter])
def make_offer(request, pk):
    """Create the offer (or replace one that was declined, withdrawn or expired)."""
    _, app = _company_app(request, pk, manage=True)
    if app.status in ("rejected", "selected"):
        return Response({"detail": "This application is closed."}, status=400)
    existing = getattr(app, "offer", None)
    if existing and existing.status in ("pending", "accepted") and not existing.is_expired:
        return Response({"detail": "There is already an open offer. Withdraw it first to change it."}, status=400)
    data = {
        "role_title": app.internship.title, "stipend": app.internship.stipend,
        "duration_months": app.internship.duration_months, "location": app.internship.location,
        **request.data,
    }
    serializer = OfferSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    if existing:
        existing.delete()
    offer = serializer.save(application=app, sent_by=request.user)
    services.announce_offer(offer, request.user)
    return Response(OfferSerializer(offer).data, status=201)


@api_view(["POST"])
@permission_classes([IsRecruiter])
def withdraw_offer(request, pk):
    m = require_membership(request.user, manage=True)
    offer = get_object_or_404(Offer.objects.select_related("application__student__user", "application__internship__company"),
                              pk=pk, application__internship__company=m.company)
    if offer.status != "pending":
        return Response({"detail": f"This offer is already {offer.status}."}, status=400)
    offer.status = "withdrawn"
    offer.save(update_fields=["status"])
    app = offer.application
    services.log(app, ApplicationEvent.Kind.OFFER, request.user, detail="Offer withdrawn")
    from notifications.service import notify

    notify(app.student.user, "offer", f"Offer withdrawn: {app.internship.company.name}",
           f"The offer for {app.internship.title} was withdrawn.", services.STUDENT_LINK, email=True)
    return Response(OfferSerializer(offer).data)


# ── Bulk actions and email templates ────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsRecruiter])
def bulk_action(request):
    """{"ids": [...], "action": "move" | "tag" | "untag" | "email", "status", "tag", "subject", "body"}"""
    m = require_membership(request.user, manage=True)
    ids = [int(i) for i in request.data.get("ids", []) if str(i).isdigit()]
    apps = list(recruiter_qs(m.company).filter(pk__in=ids))
    if not apps:
        return Response({"detail": "Select at least one applicant."}, status=400)
    action = request.data.get("action")
    done = 0
    if action == "move":
        to = request.data.get("status")
        if to not in Application.Status.values:
            return Response({"status": "Unknown stage."}, status=400)
        for app in apps:
            done += services.move(app, to, request.user, notify_student=request.data.get("notify", True) is not False)
    elif action in ("tag", "untag"):
        tag = " ".join(str(request.data.get("tag", "")).split())[:40]
        if not tag:
            return Response({"tag": "Enter a tag."}, status=400)
        for app in apps:
            tags = [t for t in (app.tags or []) if t.lower() != tag.lower()]
            if action == "tag":
                tags.append(tag)
            if tags != app.tags:
                app.tags = tags[:15]
                app.save(update_fields=["tags"])
                services.log(app, ApplicationEvent.Kind.TAGGED, request.user, detail=", ".join(app.tags) or "cleared")
                done += 1
    elif action == "email":
        subject, body = str(request.data.get("subject", "")).strip(), str(request.data.get("body", "")).strip()
        if not subject or not body:
            return Response({"detail": "Add a subject and a message."}, status=400)
        for app in apps:
            services.send_candidate_email(app, subject, body, request.user)
            done += 1
    else:
        return Response({"action": "Unknown action."}, status=400)
    return Response({"updated": done, "total": len(apps)})


class EmailTemplateListView(generics.ListCreateAPIView):
    serializer_class = EmailTemplateSerializer
    permission_classes = [IsRecruiter]
    pagination_class = None

    def get_queryset(self):
        return EmailTemplate.objects.filter(company=require_membership(self.request.user).company)

    def perform_create(self, serializer):
        serializer.save(company=require_membership(self.request.user, manage=True).company, created_by=self.request.user)


class EmailTemplateDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = EmailTemplateSerializer
    permission_classes = [IsRecruiter]

    def get_queryset(self):
        return EmailTemplate.objects.filter(company=require_membership(self.request.user, manage=True).company)


# ── Export and analytics ────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsRecruiter])
def export_csv(request):
    m = require_membership(request.user)
    res = HttpResponse(content_type="text/csv; charset=utf-8")
    res["Content-Disposition"] = 'attachment; filename="applicants.csv"'
    res.write("﻿")  # so Excel reads the UTF-8 correctly
    w = csv.writer(res)
    w.writerow(["Name", "Email", "University", "Degree", "Branch", "CGPA", "Graduation year", "Internship",
                "Stage", "Source", "Applied on", "Average rating", "Match %", "Tags", "Verified by university"])
    labels = dict(Application.Status.choices)
    for a in _filtered(request, m.company):
        s, u = a.student, a.student.user
        stars = [r.stars for r in a.ratings.all()]
        w.writerow([
            u.get_full_name() or u.username, u.email, s.university.name if s.university else "", s.degree, s.branch,
            s.cgpa or "", s.graduation_year or "", a.internship.title, labels.get(a.status, a.status), a.get_source_display(),
            timezone.localtime(a.applied_at).strftime("%Y-%m-%d"), round(mean(stars), 1) if stars else "",
            match_for(a)["score"], ", ".join(a.tags or []), "yes" if s.verification_status == "verified" else "no",
        ])
    return res


def _days(delta):
    return round(delta.total_seconds() / 86400, 1)


@api_view(["GET"])
@permission_classes([IsRecruiter])
def recruiter_analytics(request):
    """Funnel, drop-off, time-to-hire, time-in-stage, sources and per-listing numbers. ?internship= narrows it."""
    m = require_membership(request.user)
    apps = Application.objects.filter(internship__company=m.company).select_related("internship")
    if request.query_params.get("internship"):
        apps = apps.filter(internship_id=request.query_params["internship"])
    apps = list(apps.prefetch_related("events"))
    index = {s: i for i, s in enumerate(STAGES)}

    reached = Counter()
    time_in = defaultdict(list)
    hire_days = []
    for a in apps:
        moves = sorted((e for e in a.events.all() if e.kind == "moved"), key=lambda e: e.created_at)
        furthest = index.get(a.status, 0)
        for e in moves:
            furthest = max(furthest, index.get(e.to_status, 0))
        for i in range(furthest + 1):
            reached[STAGES[i]] += 1
        prev_time, prev_stage = a.applied_at, "applied"
        for e in moves:
            time_in[prev_stage].append(_days(e.created_at - prev_time))
            prev_time, prev_stage = e.created_at, e.to_status
            if e.to_status == "selected":
                hire_days.append(_days(e.created_at - a.applied_at))

    funnel = []
    for i, s in enumerate(STAGES):
        prev = reached[STAGES[i - 1]] if i else None
        funnel.append({
            "stage": s, "label": dict(Application.Status.choices)[s], "count": reached[s],
            "current": sum(1 for a in apps if a.status == s),
            "conversion": round(reached[s] / prev * 100, 1) if prev else (100.0 if reached[s] else 0.0),
        })

    per_listing = defaultdict(lambda: {"applicants": 0, "active": 0, "hired": 0, "rejected": 0})
    for a in apps:
        row = per_listing[(a.internship_id, a.internship.title)]
        row["applicants"] += 1
        row["hired"] += a.status == "selected"
        row["rejected"] += a.status == "rejected"
        row["active"] += a.status not in ("selected", "rejected")

    offers = Offer.objects.filter(application__in=[a.id for a in apps])
    sent, accepted = offers.count(), offers.filter(status="accepted").count()
    return Response({
        "total": len(apps),
        "rejected": sum(1 for a in apps if a.status == "rejected"),
        "funnel": funnel,
        "time_to_hire_days": round(mean(hire_days), 1) if hire_days else None,
        "time_in_stage_days": [
            {"stage": s, "label": dict(Application.Status.choices)[s], "avg_days": round(mean(time_in[s]), 1) if time_in[s] else None}
            for s in STAGES[:-1]
        ],
        "sources": [{"source": k, "label": dict(Application.Source.choices).get(k, k), "count": v}
                    for k, v in Counter(a.source for a in apps).most_common()],
        "offers": {"sent": sent, "accepted": accepted, "acceptance_rate": round(accepted / sent * 100, 1) if sent else None},
        "per_listing": [{"id": k[0], "title": k[1], **v} for k, v in sorted(per_listing.items(), key=lambda kv: -kv[1]["applicants"])],
        "upcoming_interviews": Interview.objects.filter(
            application__internship__company=m.company, status="scheduled", scheduled_at__gte=timezone.now()
        ).count(),
    })
