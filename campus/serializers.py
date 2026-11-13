from rest_framework import serializers

from institutions.models import University

from .models import Announcement, DriveRegistration, PlacementDrive


class UniversityEditSerializer(serializers.ModelSerializer):
    class Meta:
        model = University
        fields = ["id", "name", "location", "website", "established_year", "logo"]
        read_only_fields = ["id"]


class DriveSerializer(serializers.ModelSerializer):
    company_display = serializers.CharField(source="display_company", read_only=True)
    internship_title = serializers.CharField(source="internship.title", read_only=True, default=None)
    registrations_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = PlacementDrive
        fields = [
            "id", "title", "description", "company", "company_name", "company_display", "internship", "internship_title",
            "drive_date", "venue", "registration_deadline", "min_cgpa", "allowed_branches", "graduation_year",
            "status", "registrations_count", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        company = attrs.get("company", getattr(self.instance, "company", None))
        name = attrs.get("company_name", getattr(self.instance, "company_name", ""))
        if not company and not name.strip():
            raise serializers.ValidationError({"company_name": "Pick a company or type its name."})
        internship = attrs.get("internship", getattr(self.instance, "internship", None))
        if internship and company and internship.company_id != company.id:
            raise serializers.ValidationError({"internship": "That internship belongs to a different company."})
        if internship and not company:
            attrs["company"] = internship.company
        cgpa = attrs.get("min_cgpa")
        if cgpa is not None and not (0 <= cgpa <= 10):
            raise serializers.ValidationError({"min_cgpa": "CGPA is on a 0–10 scale."})
        return attrs


class RegistrationSerializer(serializers.ModelSerializer):
    student_id = serializers.IntegerField(source="student.id", read_only=True)
    name = serializers.SerializerMethodField()
    email = serializers.EmailField(source="student.user.email", read_only=True)
    branch = serializers.CharField(source="student.branch", read_only=True)
    cgpa = serializers.DecimalField(source="student.cgpa", max_digits=4, decimal_places=2, read_only=True)
    verification_status = serializers.CharField(source="student.verification_status", read_only=True)

    class Meta:
        model = DriveRegistration
        fields = ["id", "student_id", "name", "email", "branch", "cgpa", "verification_status", "registered_at", "attended", "outcome"]
        read_only_fields = ["id", "registered_at"]

    def get_name(self, obj):
        u = obj.student.user
        return u.get_full_name() or u.username


class AnnouncementSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = ["id", "title", "body", "pinned", "author_name", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_author_name(self, obj):
        return (obj.author.get_full_name() or obj.author.username) if obj.author else "Placement cell"
