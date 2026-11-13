from django.conf import settings
from django.db import models


class Notification(models.Model):
    """Something that happened that a user should know about — shown under the bell."""

    class Kind(models.TextChoices):
        STATUS = "status", "Application status"
        APPLICANT = "applicant", "New applicant"
        INTERVIEW = "interview", "Interview"
        OFFER = "offer", "Offer"
        DRIVE = "drive", "Placement drive"
        ANNOUNCEMENT = "announcement", "Announcement"
        VERIFICATION = "verification", "Verification"
        TEAM = "team", "Team"
        MESSAGE = "message", "Message"
        SYSTEM = "system", "System"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.SYSTEM)
    title = models.CharField(max_length=200)
    body = models.CharField(max_length=500, blank=True)
    link = models.CharField(max_length=300, blank=True)  # an app path, e.g. /dashboard/student/applications
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["user", "is_read"])]

    def __str__(self):
        return f"{self.user} · {self.title}"
