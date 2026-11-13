"""Custom user model with role-based access."""

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        STUDENT = "student", "Student"
        COMPANY = "company", "Company"
        UNIVERSITY = "university", "University"
        ADMIN = "admin", "Admin"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.STUDENT,
    )
    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Prefer not to say"

    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True, default="")
    phone = models.CharField(max_length=15, blank=True)
    profile_photo = models.ImageField(
        upload_to="profile_photos/", null=True, blank=True
    )
    # False for accounts created through Google until the person picks a role, gender, name and username.
    # The app sends them to /complete-profile until it is True.
    profile_completed = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.get_full_name()} ({self.role})"

    @property
    def is_student(self):
        return self.role == self.Role.STUDENT

    @property
    def is_company(self):
        return self.role == self.Role.COMPANY

    @property
    def is_university(self):
        return self.role == self.Role.UNIVERSITY


class EmailOTP(models.Model):
    """A one-time 6-digit code emailed to someone, for sign-up or a password reset. Only a hash of the code is stored."""

    class Purpose(models.TextChoices):
        REGISTRATION = "registration", "Registration"
        PASSWORD_RESET = "password_reset", "Password reset"

    email = models.EmailField(db_index=True)
    purpose = models.CharField(max_length=20, choices=Purpose.choices)
    code_hash = models.CharField(max_length=128)
    attempts = models.PositiveSmallIntegerField(default=0)
    used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.email} · {self.purpose} · {self.created_at:%Y-%m-%d %H:%M}"
