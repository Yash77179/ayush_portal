"""Serializers for institutions app."""

from rest_framework import serializers
from .models import Achievement, Certification, Experience, University, StudentProfile, Company, CompanyMembership


class UniversitySerializer(serializers.ModelSerializer):
    class Meta:
        model = University
        fields = ["id", "name", "location", "website", "established_year", "logo"]


class StudentProfileSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.get_full_name", read_only=True)
    university = UniversitySerializer(read_only=True)
    university_id = serializers.PrimaryKeyRelatedField(
        queryset=University.objects.all(), source="university", write_only=True, required=False
    )
    profile_completion = serializers.IntegerField(read_only=True)

    class Meta:
        model = StudentProfile
        fields = [
            "id", "user_email", "user_name", "university", "university_id",
            "degree", "branch", "graduation_year", "cgpa",
            "resume_url", "resume_file", "linkedin_url", "github_url",
            "bio", "is_available", "profile_completion",
            "enrollment_number", "verification_status", "verification_note", "verified_at",
        ]
        read_only_fields = ["verification_status", "verification_note", "verified_at"]

    VERIFIED_FACTS = ("university", "degree", "branch", "graduation_year", "cgpa", "enrollment_number")

    def update(self, instance, validated_data):
        changed = any(k in validated_data and validated_data[k] != getattr(instance, k) for k in self.VERIFIED_FACTS)
        if changed and instance.verification_status != StudentProfile.Verification.UNVERIFIED:
            # The university confirmed the old details, not these — ask them to look again.
            instance.verification_status = StudentProfile.Verification.UNVERIFIED
            instance.verified_at = None
            instance.verification_note = ""
        return super().update(instance, validated_data)


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = [
            "id", "name", "website", "description", "industry",
            "size", "location", "logo", "is_verified",
            "culture", "founded_year", "linkedin_url",
        ]
        read_only_fields = ["id", "is_verified"]

    def validate_name(self, value):
        value = " ".join(value.split())
        if len(value) < 2:
            raise serializers.ValidationError("Enter your company's name.")
        clash = Company.objects.filter(name__iexact=value)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError(
                "This company is already on CareerBridge. Ask one of its admins to add you to the team."
            )
        return value

    def validate_logo(self, value):
        if value and value.size > MAX_UPLOAD:
            raise serializers.ValidationError("Logo must be 5 MB or smaller.")
        return value


class CompanyMembershipSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)

    class Meta:
        model = CompanyMembership
        fields = ["id", "company", "role", "is_active", "joined_at"]


class TeamMemberSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    name = serializers.SerializerMethodField()
    email = serializers.EmailField(source="user.email", read_only=True)
    photo = serializers.ImageField(source="user.profile_photo", read_only=True)

    class Meta:
        model = CompanyMembership
        fields = ["id", "user_id", "name", "email", "photo", "role", "is_active", "joined_at"]
        read_only_fields = ["id", "joined_at"]

    def get_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


MAX_UPLOAD = 5 * 1024 * 1024
CERT_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}


class ExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Experience
        fields = ["id", "title", "company", "location", "start_date", "end_date", "is_current", "description"]

    def validate(self, attrs):
        start, end = attrs.get("start_date"), attrs.get("end_date")
        if attrs.get("is_current"):
            attrs["end_date"] = None
        elif start and end and end < start:
            raise serializers.ValidationError({"end_date": "End date can't be before the start date."})
        return attrs


class CertificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Certification
        fields = ["id", "name", "issuer", "issued_on", "credential_id", "credential_url", "file"]

    def validate_file(self, value):
        if value:
            import os

            if value.size > MAX_UPLOAD:
                raise serializers.ValidationError("File must be 5 MB or smaller.")
            if os.path.splitext(value.name)[1].lower() not in CERT_EXTENSIONS:
                raise serializers.ValidationError("Upload a PDF or an image (PNG, JPG, WebP).")
        return value


class AchievementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Achievement
        fields = ["id", "title", "detail", "achieved_on"]
