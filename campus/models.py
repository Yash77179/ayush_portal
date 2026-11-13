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
    university = models.ForeignKey("institutions.University", on_delete=models.CASCADE, related_name="announcements")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    title = models.CharField(max_length=200)
    body = models.TextField()
    pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-pinned", "-created_at"]
