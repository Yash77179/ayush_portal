from rest_framework import serializers

from institutions.models import University

from .models import Announcement, AnnouncementAttachment, DriveRegistration, PlacementDrive


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


class AttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = AnnouncementAttachment
        fields = ["id", "name", "size", "content_type", "url"]

    def get_url(self, obj):
        req = self.context.get("request")
        url = obj.file.url
        return req.build_absolute_uri(url) if req and url.startswith("/") else url


class AnnouncementSerializer(serializers.ModelSerializer):
    """Who it went to is fixed once sent: audience fields are write-once (ignored on edit, see the view).
    `acknowledged` is filled for the student viewing it (context["student"]); ack_count for the placement cell."""

    author_name = serializers.SerializerMethodField()
    audience_label = serializers.SerializerMethodField()
    drive_title = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()
    ack_count = serializers.SerializerMethodField()
    acknowledged = serializers.SerializerMethodField()
    student_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    attachment_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)

    class Meta:
        model = Announcement
        fields = [
            "id", "title", "body", "pinned", "kind", "audience", "drive", "drive_title", "segment", "branches",
            "graduation_year", "student_ids", "attachment_ids", "recipient_count", "audience_label", "author_name",
            "link_url", "link_label", "event_at", "venue", "expires_at", "require_ack", "attachments", "ack_count",
            "acknowledged", "created_at",
        ]
        read_only_fields = ["id", "created_at", "recipient_count"]

    def get_author_name(self, obj):
        return (obj.author.get_full_name() or obj.author.username) if obj.author else "Placement cell"

    def get_drive_title(self, obj):
        return obj.drive.title if obj.drive_id and obj.drive else ""

    def get_attachments(self, obj):
        return AttachmentSerializer(obj.attachments.all(), many=True, context=self.context).data

    def get_ack_count(self, obj):
        return obj.acks.count() if obj.require_ack else 0

    def get_acknowledged(self, obj):
        student = self.context.get("student")
        return bool(student and obj.require_ack and obj.acks.filter(student=student).exists())

    def get_audience_label(self, obj):
        if obj.audience == "drive":
            seg = Announcement.Segment(obj.segment).label if obj.segment else "Everyone registered"
            return f"{seg} · {obj.drive.title}" if obj.drive_id and obj.drive else seg
        if obj.audience == "cohort":
            parts = [b.strip() for b in obj.branches.split(",") if b.strip()]
            if obj.graduation_year:
                parts.append(f"Batch {obj.graduation_year}")
            return " · ".join(parts) or "Branch & batch"
        if obj.audience == "students":
            return "Chosen students"
        return "All students"
