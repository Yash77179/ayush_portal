"""Models for institutions app — University, StudentProfile, Company, CompanyMembership."""

from django.conf import settings
from django.db import models


class University(models.Model):
    name = models.CharField(max_length=200)
    location = models.CharField(max_length=200, blank=True)
    website = models.URLField(blank=True)
    established_year = models.PositiveIntegerField(null=True, blank=True)
    logo = models.ImageField(upload_to="university_logos/", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Universities"
        ordering = ["name"]

    def __str__(self):
        return self.name


class StudentProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="student_profile",
    )
    university = models.ForeignKey(
        University,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
    )
    degree = models.CharField(max_length=100, blank=True)
    branch = models.CharField(max_length=100, blank=True)
    graduation_year = models.PositiveIntegerField(null=True, blank=True)
    cgpa = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    resume_url = models.URLField(blank=True)
    resume_file = models.FileField(upload_to="resumes/", null=True, blank=True)
    linkedin_url = models.URLField(blank=True)
    github_url = models.URLField(blank=True)
    bio = models.TextField(blank=True)
    is_available = models.BooleanField(default=True)

    # Set by the university's placement cell: confirms the student is enrolled and the CGPA is right.
    class Verification(models.TextChoices):
        UNVERIFIED = "unverified", "Not verified"
        VERIFIED = "verified", "Verified"
        REJECTED = "rejected", "Rejected"

    enrollment_number = models.CharField(max_length=50, blank=True)
    verification_status = models.CharField(max_length=20, choices=Verification.choices, default=Verification.UNVERIFIED)
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    verification_note = models.CharField(max_length=300, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.get_full_name()} — {self.university or 'No University'}"

    @property
    def profile_completion(self):
        """Returns a rough % of profile fields completed."""
        fields = [
            self.university_id, self.degree, self.branch, self.graduation_year,
            self.cgpa, self.resume_url or self.resume_file, self.linkedin_url, self.bio,
        ]
        filled = sum(1 for f in fields if f)
        return round(filled / len(fields) * 100)


class Experience(models.Model):
    """A previous job, internship or project on a student's profile."""

    profile = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name="experiences")
    title = models.CharField(max_length=150)
    company = models.CharField(max_length=150)
    location = models.CharField(max_length=100, blank=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    is_current = models.BooleanField(default=False)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["-is_current", "-start_date"]

    def __str__(self):
        return f"{self.title} @ {self.company}"


class Certification(models.Model):
    """A certificate the student earned, with an optional uploaded copy."""

    profile = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name="certifications")
    name = models.CharField(max_length=200)
    issuer = models.CharField(max_length=150)
    issued_on = models.DateField(null=True, blank=True)
    credential_id = models.CharField(max_length=100, blank=True)
    credential_url = models.URLField(blank=True)
    file = models.FileField(upload_to="certifications/", null=True, blank=True)

    class Meta:
        ordering = ["-issued_on", "-id"]

    def __str__(self):
        return f"{self.name} ({self.issuer})"


class Achievement(models.Model):
    """An award, hackathon result, publication or other highlight."""

    profile = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name="achievements")
    title = models.CharField(max_length=200)
    detail = models.TextField(blank=True)
    achieved_on = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["-achieved_on", "-id"]

    def __str__(self):
        return self.title


class Company(models.Model):
    name = models.CharField(max_length=200)
    website = models.URLField(blank=True)
    description = models.TextField(blank=True)
    industry = models.CharField(max_length=100, blank=True)
    size = models.CharField(
        max_length=30,
        choices=[
            ("startup", "Startup (1–50)"),
            ("small", "Small (51–200)"),
            ("medium", "Medium (201–1000)"),
            ("large", "Large (1000+)"),
        ],
        blank=True,
    )
    location = models.CharField(max_length=200, blank=True)
    logo = models.ImageField(upload_to="company_logos/", null=True, blank=True)
    culture = models.TextField(blank=True, help_text="What it's like to work here — shown on the public company page.")
    founded_year = models.PositiveIntegerField(null=True, blank=True)
    linkedin_url = models.URLField(blank=True)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Companies"
        ordering = ["name"]

    def __str__(self):
        return self.name


class CompanyMembership(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "Company admin"  # edits the company page and team, plus everything a recruiter does
        RECRUITER = "recruiter", "Recruiter"  # posts internships, moves candidates, schedules interviews, sends offers
        INTERVIEWER = "interviewer", "Interviewer"  # sees candidates, leaves notes, ratings and scorecards

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="company_memberships",
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.ADMIN)
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "company"],
                name="unique_company_membership",
            )
        ]

    def __str__(self):
        return f"{self.user} @ {self.company}"

    @property
    def can_manage_pipeline(self):
        return self.role in (self.Role.ADMIN, self.Role.RECRUITER)


class UniversityStaff(models.Model):
    """A placement-cell member: links a university-role user to the university they manage."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="university_staff")
    university = models.ForeignKey(University, on_delete=models.CASCADE, related_name="staff")
    is_admin = models.BooleanField(default=False)
    title = models.CharField(max_length=100, blank=True, help_text="e.g. Training & Placement Officer")
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "University staff"

    def __str__(self):
        return f"{self.user} @ {self.university}"
