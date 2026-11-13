"""Models for internships app — Skill, StudentSkill, Internship, InternshipSkill."""

from django.db import models


class Skill(models.Model):
    name = models.CharField(max_length=100, unique=True)
    category = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class StudentSkill(models.Model):
    class Proficiency(models.TextChoices):
        BEGINNER = "beginner", "Beginner"
        INTERMEDIATE = "intermediate", "Intermediate"
        ADVANCED = "advanced", "Advanced"

    student = models.ForeignKey(
        "institutions.StudentProfile",
        on_delete=models.CASCADE,
        related_name="student_skills",
    )
    skill = models.ForeignKey(
        Skill,
        on_delete=models.CASCADE,
        related_name="student_skills",
    )
    proficiency = models.CharField(
        max_length=20,
        choices=Proficiency.choices,
        default=Proficiency.BEGINNER,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["student", "skill"],
                name="unique_student_skill",
            )
        ]

    def __str__(self):
        return f"{self.student.user.username} — {self.skill.name} ({self.proficiency})"


class Internship(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        CLOSED = "closed", "Closed"

    class WorkMode(models.TextChoices):
        ONSITE = "onsite", "On-site"
        HYBRID = "hybrid", "Hybrid"
        REMOTE = "remote", "Remote"

    company = models.ForeignKey(
        "institutions.Company",
        on_delete=models.CASCADE,
        related_name="internships",
    )
    posted_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="posted_internships",
    )
    title = models.CharField(max_length=200)
    description = models.TextField()
    location = models.CharField(max_length=200, blank=True)
    work_mode = models.CharField(
        max_length=20,
        choices=WorkMode.choices,
        default=WorkMode.ONSITE,
    )
    stipend = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    duration_months = models.PositiveIntegerField(default=3)
    openings = models.PositiveIntegerField(default=1)
    deadline = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    # Eligibility: students who don't meet these can't apply (and are told why). Blank = no rule.
    min_cgpa = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    allowed_branches = models.CharField(max_length=500, blank=True, help_text="Comma-separated, e.g. CSE, IT, ECE")
    allowed_degrees = models.CharField(max_length=300, blank=True, help_text="Comma-separated, e.g. B.Tech, BCA")
    graduation_year_min = models.PositiveIntegerField(null=True, blank=True)
    graduation_year_max = models.PositiveIntegerField(null=True, blank=True)
    required_skills = models.ManyToManyField(
        Skill,
        through="InternshipSkill",
        related_name="internships",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} @ {self.company.name}"


class InternshipSkill(models.Model):
    internship = models.ForeignKey(
        Internship,
        on_delete=models.CASCADE,
        related_name="internship_skills",
    )
    skill = models.ForeignKey(
        Skill,
        on_delete=models.CASCADE,
    )
    is_required = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["internship", "skill"],
                name="unique_internship_skill",
            )
        ]

    def __str__(self):
        req = "Required" if self.is_required else "Preferred"
        return f"{self.skill.name} ({req}) for {self.internship.title}"


class ScreeningQuestion(models.Model):
    """A question students answer when they apply. A knockout answer rejects the application automatically."""

    class Kind(models.TextChoices):
        TEXT = "text", "Short answer"
        YESNO = "yesno", "Yes / No"
        CHOICE = "choice", "Multiple choice"

    internship = models.ForeignKey(Internship, on_delete=models.CASCADE, related_name="screening_questions")
    text = models.CharField(max_length=300)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.TEXT)
    choices = models.JSONField(default=list, blank=True)
    required = models.BooleanField(default=True)
    # For yes/no and multiple choice: the answer that is needed. Any other answer = automatic rejection.
    knockout_answer = models.CharField(max_length=200, blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.text
