"""The hiring workflow: every stage move, interview and offer goes through here so it is logged and the right people hear about it."""

import re
from datetime import timedelta, timezone as dt_timezone

from django.utils import timezone

from notifications.service import notify, send_email

from .models import Application, ApplicationEvent

STUDENT_LINK = "/dashboard/student/applications"

# What the student is told when their application reaches a stage (None = say nothing).
STUDENT_MESSAGES = {
    "review": ("Your application is being reviewed", "{company} is reviewing your application for {internship}."),
    "shortlisted": ("You've been shortlisted", "{company} shortlisted you for {internship}. Next steps will follow soon."),
    "interview": ("You're moving to interviews", "{company} wants to interview you for {internship}. Look out for the invite."),
    "offered": None,  # the offer itself sends the message
    "selected": ("You're hired! 🎉", "Congratulations — you've been hired for {internship} at {company}."),
    "rejected": (
        "Update on your application",
        "Thank you for applying to {internship} at {company}. After careful review, the team has decided not to move "
        "forward this time. Please keep applying — the right role is out there.",
    ),
}


def candidate_link(app):
    return f"/dashboard/company/applicants/{app.pk}"


def log(app, kind, actor=None, *, detail="", from_status="", to_status=""):
    return ApplicationEvent.objects.create(
        application=app, actor=actor, kind=kind, detail=detail[:500], from_status=from_status, to_status=to_status
    )


def _ctx(app):
    user = app.student.user
    return {
        "first_name": user.first_name or user.username,
        "last_name": user.last_name,
        "name": user.get_full_name() or user.username,
        "internship": app.internship.title,
        "company": app.internship.company.name,
    }


def render_template(text, app):
    ctx = _ctx(app)
    return re.sub(r"\{\{\s*(\w+)\s*\}\}", lambda m: str(ctx.get(m.group(1), m.group(0))), text)


def move(app, to_status, actor=None, *, notify_student=True, detail=""):
    """Move an application to a new stage. Returns False if it was already there."""
    if to_status not in Application.Status.values:
        raise ValueError(f"Unknown stage {to_status!r}")
    old = app.status
    if old == to_status:
        return False
    app.status = to_status
    app.status_changed_at = timezone.now()
    app.save(update_fields=["status", "status_changed_at", "updated_at"])
    log(app, ApplicationEvent.Kind.MOVED, actor, from_status=old, to_status=to_status, detail=detail)
    message = STUDENT_MESSAGES.get(to_status)
    if notify_student and message:
        title, body = message
        ctx = _ctx(app)
        notify(
            app.student.user, "status", title, body.format(**ctx), STUDENT_LINK,
            email=True, email_body=f"Hi {ctx['first_name']},\n\n{body.format(**ctx)}\n\n— {ctx['company']} via CareerBridge",
        )
    return True


def team_users(company, *, managers_only=False):
    qs = company.memberships.filter(is_active=True).select_related("user")
    if managers_only:
        qs = qs.filter(role__in=["admin", "recruiter"])
    return [m.user for m in qs]


def on_new_application(app):
    log(app, ApplicationEvent.Kind.APPLIED, app.student.user, to_status=app.status,
        detail="via campus drive" if app.source == "drive" else "")
    name = app.student.user.get_full_name() or app.student.user.username
    notify(
        team_users(app.internship.company, managers_only=True), "applicant",
        f"New applicant for {app.internship.title}", f"{name} applied.", candidate_link(app),
    )


def send_candidate_email(app, subject, body, actor):
    subject, body = render_template(subject, app), render_template(body, app)
    ok = send_email(app.student.user.email, subject, body)
    log(app, ApplicationEvent.Kind.EMAILED, actor, detail=subject)
    notify(app.student.user, "message", subject, body[:300], STUDENT_LINK)
    return ok


# ── Interviews ──────────────────────────────────────────────────────────────

def _ics_escape(text):
    return str(text).replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def interview_ics(interview, method="REQUEST"):
    app = interview.application
    start = interview.scheduled_at.astimezone(dt_timezone.utc)
    end = start + timedelta(minutes=interview.duration_minutes)
    fmt = "%Y%m%dT%H%M%SZ"
    where = interview.meeting_link or interview.location or interview.get_mode_display()
    desc = f"{interview.round_name} for {app.internship.title} at {app.internship.company.name}."
    if interview.meeting_link:
        desc += f"\nJoin: {interview.meeting_link}"
    if interview.instructions:
        desc += f"\n\n{interview.instructions}"
    status = "CANCELLED" if interview.status == "cancelled" else "CONFIRMED"
    lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CareerBridge//ATS//EN", f"METHOD:{method}",
        "BEGIN:VEVENT",
        f"UID:interview-{interview.pk}@careerbridge",
        f"DTSTAMP:{timezone.now().astimezone(dt_timezone.utc).strftime(fmt)}",
        f"DTSTART:{start.strftime(fmt)}",
        f"DTEND:{end.strftime(fmt)}",
        f"SUMMARY:{_ics_escape(f'{interview.round_name} — {app.internship.company.name}')}",
        f"DESCRIPTION:{_ics_escape(desc)}",
        f"LOCATION:{_ics_escape(where)}",
        f"STATUS:{status}",
        "END:VEVENT", "END:VCALENDAR",
    ]
    return ("\r\n".join(lines) + "\r\n").encode()


def _when(interview):
    local = timezone.localtime(interview.scheduled_at)
    return local.strftime("%a %d %b %Y, %I:%M %p").replace(" 0", " ")


def announce_interview(interview, actor, *, updated=False):
    app = interview.application
    ctx = _ctx(app)
    verb = "updated" if updated else "scheduled"
    where = interview.meeting_link or interview.location or interview.get_mode_display()
    body = (
        f"Hi {ctx['first_name']},\n\nYour {interview.round_name.lower()} for {ctx['internship']} at {ctx['company']} is {verb}:\n\n"
        f"When: {_when(interview)} ({interview.duration_minutes} min)\nWhere: {where}\n"
        + (f"\n{interview.instructions}\n" if interview.instructions else "")
        + "\nPlease confirm or ask to reschedule from your CareerBridge applications page. The calendar invite is attached."
    )
    attach = [("interview.ics", interview_ics(interview), "text/calendar")]
    notify(
        app.student.user, "interview", f"Interview {verb}: {ctx['company']}",
        f"{interview.round_name} · {_when(interview)}", STUDENT_LINK,
        email=True, email_body=body, attachments=attach,
    )
    panel = [u for u in interview.interviewers.all() if u != actor]
    if panel:
        notify(panel, "interview", f"You're interviewing {ctx['name']}", f"{interview.round_name} · {_when(interview)}",
               candidate_link(app), email=True, attachments=attach)
    log(app, ApplicationEvent.Kind.INTERVIEW, actor, detail=f"{interview.round_name} {verb} for {_when(interview)}")


def cancel_interview(interview, actor):
    interview.status = "cancelled"
    interview.save(update_fields=["status"])
    app = interview.application
    ctx = _ctx(app)
    notify(app.student.user, "interview", f"Interview cancelled: {ctx['company']}",
           f"{interview.round_name} on {_when(interview)} was cancelled.", STUDENT_LINK, email=True,
           attachments=[("interview.ics", interview_ics(interview, "CANCEL"), "text/calendar")])
    log(app, ApplicationEvent.Kind.INTERVIEW, actor, detail=f"{interview.round_name} cancelled")


# ── Offers ──────────────────────────────────────────────────────────────────

def announce_offer(offer, actor):
    app = offer.application
    ctx = _ctx(app)
    move(app, "offered", actor, notify_student=False)
    body = (
        f"Hi {ctx['first_name']},\n\n{ctx['company']} is delighted to offer you the {offer.role_title} internship.\n\n"
        f"Stipend: ₹{offer.stipend:,.0f} / month\nStart date: {offer.start_date:%d %b %Y}\nDuration: {offer.duration_months} months\n"
        + (f"Location: {offer.location}\n" if offer.location else "")
        + f"\nPlease reply by {offer.expires_on:%d %b %Y} from your CareerBridge applications page, where you can also download the offer letter."
        + (f"\n\n{offer.message}" if offer.message else "")
    )
    notify(app.student.user, "offer", f"Offer from {ctx['company']} 🎉", f"{offer.role_title} · reply by {offer.expires_on:%d %b}",
           STUDENT_LINK, email=True, email_body=body)
    log(app, ApplicationEvent.Kind.OFFER, actor, detail=f"Offer sent · ₹{offer.stipend:,.0f}/mo · expires {offer.expires_on:%d %b}")


def respond_to_offer(offer, accept, note=""):
    app = offer.application
    offer.status = "accepted" if accept else "declined"
    offer.response_note = note[:500]
    offer.responded_at = timezone.now()
    offer.save(update_fields=["status", "response_note", "responded_at"])
    student = app.student.user
    name = student.get_full_name() or student.username
    if accept:
        move(app, "selected", student, notify_student=False, detail="Offer accepted")
    log(app, ApplicationEvent.Kind.OFFER, student, detail=f"Offer {offer.status}" + (f": {note}" if note else ""))
    recipients = team_users(app.internship.company, managers_only=True)
    notify(recipients, "offer", f"{name} {offer.status} your offer", app.internship.title, candidate_link(app), email=True)
