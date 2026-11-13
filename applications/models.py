"""Models for applications app — the application itself plus the recruiter hiring system (ATS) around it."""

from django.conf import settings
from django.db import models
from django.utils import timezone


class Application(models.Model):
    class Status(models.TextChoices):
        APPLIED = "applied", "Applied"
        REVIEW = "review", "Screening"
        SHORTLISTED = "shortlisted", "Shortlisted"
        INTERVIEW = "interview", "Interview"
        OFFERED = "offered", "Offer"
        SELECTED = "selected", "Hired"
        REJECTED = "rejected", "Rejected"

    class Source(models.TextChoices):
        DIRECT = "direct", "Applied directly"
        DRIVE = "drive", "Campus drive"
        REFERRAL = "referral", "Referral"

    student = models.ForeignKey(
        "institutions.StudentProfile",
        on_delete=models.CASCADE,
        related_name="applications",
    )
    internship = models.ForeignKey(
        "internships.Internship",
        on_delete=models.CASCADE,
        related_name="applications",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.APPLIED,
    )
    cover_letter = models.TextField(blank=True)
    applied_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    recruiter_notes = models.TextField(blank=True)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.DIRECT)
    answers = models.JSONField(default=list, blank=True)  # [{"question_id", "question", "answer"}]
    tags = models.JSONField(default=list, blank=True)  # ["strong DSA", "relocate OK"]
    viewed_at = models.DateTimeField(null=True, blank=True)  # first time a recruiter opened it
    status_changed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-applied_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "internship"],
                name="unique_student_internship_application",
            )
        ]

    def __str__(self):
        return f"{self.student.user.username} → {self.internship.title} [{self.status}]"


class ApplicationEvent(models.Model):
    """One line in an application's activity timeline. Internal kinds are only shown to the company."""

    class Kind(models.TextChoices):
        APPLIED = "applied", "Applied"
        VIEWED = "viewed", "Viewed"
        MOVED = "moved", "Moved"
        NOTE = "note", "Note added"
        RATED = "rated", "Rated"
        TAGGED = "tagged", "Tags changed"
        EMAILED = "emailed", "Emailed"
        INTERVIEW = "interview", "Interview"
        FEEDBACK = "feedback", "Scorecard"
        OFFER = "offer", "Offer"
        KNOCKOUT = "knockout", "Screening knockout"

    INTERNAL_KINDS = {"note", "rated", "tagged", "feedback", "knockout", "viewed"}

    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="events")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    kind = models.CharField(max_length=20, choices=Kind.choices)
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20, blank=True)
    detail = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]

    @property
    def internal(self):
        return self.kind in self.INTERNAL_KINDS


class ApplicationNote(models.Model):
    """A private recruiter note — never shown to the student."""

    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="notes")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ApplicationRating(models.Model):
    """1–5 stars, one per recruiter per application."""

    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="ratings")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    stars = models.PositiveSmallIntegerField()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["application", "author"], name="one_rating_per_recruiter")]


class Interview(models.Model):
    class Mode(models.TextChoices):
        VIDEO = "video", "Video call"
        PHONE = "phone", "Phone"
        ONSITE = "onsite", "On-site"

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    class Response(models.TextChoices):
        PENDING = "pending", "Awaiting reply"
        CONFIRMED = "confirmed", "Confirmed"
        RESCHEDULE = "reschedule", "Asked to reschedule"

    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="interviews")
    round_name = models.CharField(max_length=100, default="Interview")
    scheduled_at = models.DateTimeField()
    duration_minutes = models.PositiveSmallIntegerField(default=45)
    mode = models.CharField(max_length=10, choices=Mode.choices, default=Mode.VIDEO)
    meeting_link = models.URLField(blank=True)
    location = models.CharField(max_length=200, blank=True)
    interviewers = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="interviews_to_take")
    instructions = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.SCHEDULED)
    candidate_response = models.CharField(max_length=12, choices=Response.choices, default=Response.PENDING)
    candidate_note = models.CharField(max_length=500, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["scheduled_at"]


class InterviewFeedback(models.Model):
    """An interviewer's scorecard."""

    class Recommendation(models.TextChoices):
        STRONG_YES = "strong_yes", "Strong hire"
        YES = "yes", "Hire"
        NO = "no", "No hire"
        STRONG_NO = "strong_no", "Strong no hire"

    interview = models.ForeignKey(Interview, on_delete=models.CASCADE, related_name="feedback")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    technical = models.PositiveSmallIntegerField()
    communication = models.PositiveSmallIntegerField()
    culture = models.PositiveSmallIntegerField()
    recommendation = models.CharField(max_length=12, choices=Recommendation.choices)
    comments = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["interview", "author"], name="one_scorecard_per_interviewer")]


class Offer(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Waiting for reply"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"
        WITHDRAWN = "withdrawn", "Withdrawn"

    application = models.OneToOneField(Application, on_delete=models.CASCADE, related_name="offer")
    role_title = models.CharField(max_length=200)
    stipend = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    start_date = models.DateField()
    duration_months = models.PositiveIntegerField(default=3)
    location = models.CharField(max_length=200, blank=True)
    expires_on = models.DateField()
    message = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    response_note = models.CharField(max_length=500, blank=True)
    sent_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    @property
    def is_expired(self):
        return self.status == self.Status.PENDING and self.expires_on < timezone.localdate()


class EmailTemplate(models.Model):
    """A reusable email with {{first_name}}, {{last_name}}, {{internship}}, {{company}} placeholders."""

    company = models.ForeignKey("institutions.Company", on_delete=models.CASCADE, related_name="email_templates")
    name = models.CharField(max_length=100)
    subject = models.CharField(max_length=200)
    body = models.TextField()
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
