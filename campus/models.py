"""University placement cell: campus drives, registrations and announcements."""

from django.conf import settings
from django.db import models


class PlacementDrive(models.Model):
    """A company recruiting on campus on a given day. Linked to an internship, registering also applies to it."""

    class Status(models.TextChoices):
        UPCOMING = "upcoming", "Upcoming"
        ONGOING = "ongoing", "Ongoing"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    university = models.ForeignKey("institutions.University", on_delete=models.CASCADE, related_name="drives")
    company = models.ForeignKey("institutions.Company", on_delete=models.SET_NULL, null=True, blank=True, related_name="drives")
    company_name = models.CharField(max_length=200, blank=True, help_text="For companies not on CareerBridge")
    internship = models.ForeignKey("internships.Internship", on_delete=models.SET_NULL, null=True, blank=True, related_name="drives")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    drive_date = models.DateTimeField()
    venue = models.CharField(max_length=200, blank=True)
    registration_deadline = models.DateField(null=True, blank=True)
    min_cgpa = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    allowed_branches = models.CharField(max_length=500, blank=True)
    graduation_year = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.UPCOMING)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["drive_date"]

    def __str__(self):
        return f"{self.title} @ {self.university}"

    @property
    def display_company(self):
        return self.company.name if self.company else self.company_name


class DriveRegistration(models.Model):
    class Outcome(models.TextChoices):
        PENDING = "pending", "Pending"
        SELECTED = "selected", "Selected"
        NOT_SELECTED = "not_selected", "Not selected"

    drive = models.ForeignKey(PlacementDrive, on_delete=models.CASCADE, related_name="registrations")
    student = models.ForeignKey("institutions.StudentProfile", on_delete=models.CASCADE, related_name="drive_registrations")
    registered_at = models.DateTimeField(auto_now_add=True)
    attended = models.BooleanField(default=False)
    outcome = models.CharField(max_length=15, choices=Outcome.choices, default=Outcome.PENDING)

    class Meta:
        ordering = ["registered_at"]
        constraints = [models.UniqueConstraint(fields=["drive", "student"], name="one_registration_per_drive")]


class Announcement(models.Model):
    """A message from the placement cell. `audience` decides who gets it; for anything but "everyone" the matching
    students are worked out once, when it's sent, and kept in `recipients` (so a later drive result doesn't change
    who already received it)."""

    class Audience(models.TextChoices):
        EVERYONE = "everyone", "Everyone"
        COHORT = "cohort", "Branch & batch"
        DRIVE = "drive", "Drive audience"
        STUDENTS = "students", "Chosen students"

    class Segment(models.TextChoices):
        REGISTERED = "registered", "Registered"
        ATTENDED = "attended", "Attended"
        MISSED = "missed", "Missed the drive"
        SELECTED = "selected", "Moving to the next round"
        NOT_SELECTED = "not_selected", "Not selected"
        PENDING = "pending", "Awaiting a result"

    class Kind(models.TextChoices):
        UPDATE = "update", "Update"
        URGENT = "urgent", "Urgent"
        REMINDER = "reminder", "Reminder"
        ROUND = "round", "Drive round"

    university = models.ForeignKey("institutions.University", on_delete=models.CASCADE, related_name="announcements")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    title = models.CharField(max_length=200)
    body = models.TextField()
    pinned = models.BooleanField(default=False)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.UPDATE)
    audience = models.CharField(max_length=10, choices=Audience.choices, default=Audience.EVERYONE)
    drive = models.ForeignKey(PlacementDrive, on_delete=models.SET_NULL, null=True, blank=True, related_name="announcements")
    segment = models.CharField(max_length=15, choices=Segment.choices, blank=True)
    branches = models.CharField(max_length=500, blank=True, help_text="Comma-separated, for the cohort audience")
    graduation_year = models.PositiveIntegerField(null=True, blank=True)
    recipients = models.ManyToManyField("institutions.StudentProfile", blank=True, related_name="announcements_received")
    recipient_count = models.PositiveIntegerField(default=0)
    # extras a real notice needs: a call to action, an event, a deadline after which it's hidden, a read receipt
    link_url = models.URLField(max_length=500, blank=True)
    link_label = models.CharField(max_length=60, blank=True)
    event_at = models.DateTimeField(null=True, blank=True)
    venue = models.CharField(max_length=200, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True, help_text="Hidden from students after this")
    require_ack = models.BooleanField(default=False, help_text="Students are asked to tap 'Got it'")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-pinned", "-created_at"]


def _attachment_path(instance, filename):
    return f"announcements/{instance.university_id}/{filename}"


class AnnouncementAttachment(models.Model):
    """A file sent with an announcement. Uploaded while composing (announcement still empty), linked on send."""

    university = models.ForeignKey("institutions.University", on_delete=models.CASCADE, related_name="+")
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, null=True, blank=True, related_name="attachments")
    file = models.FileField(upload_to=_attachment_path)
    name = models.CharField(max_length=200)
    size = models.PositiveIntegerField(default=0)
    content_type = models.CharField(max_length=100, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class AnnouncementAck(models.Model):
    """A student tapping "Got it" on an announcement that asked for it."""

    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, related_name="acks")
    student = models.ForeignKey("institutions.StudentProfile", on_delete=models.CASCADE, related_name="+")
    acknowledged_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["announcement", "student"], name="one_ack_per_student")]
