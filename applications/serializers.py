"""Serializers for applications app."""

from rest_framework import serializers

from internships.matching import calculate_skill_match
from internships.models import Internship
from internships.serializers import InternshipListSerializer
from institutions.serializers import (
    AchievementSerializer,
    CertificationSerializer,
    ExperienceSerializer,
    StudentProfileSerializer,
)

from .models import (
    Application,
    ApplicationEvent,
    ApplicationNote,
    EmailTemplate,
    Interview,
    InterviewFeedback,
    Offer,
)


def _name(user):
    return (user.get_full_name() or user.username) if user else "Someone"


def match_for(app):
    student = [ss.skill.name for ss in app.student.student_skills.all()]
    needed = [{"name": s.skill.name, "is_required": s.is_required} for s in app.internship.internship_skills.all()]
    return calculate_skill_match(student, needed)


# ── Shared pieces ───────────────────────────────────────────────────────────

class OfferSerializer(serializers.ModelSerializer):
    is_expired = serializers.BooleanField(read_only=True)
    company_name = serializers.CharField(source="application.internship.company.name", read_only=True)
    candidate_name = serializers.SerializerMethodField()

    class Meta:
        model = Offer
        fields = [
            "id", "role_title", "stipend", "start_date", "duration_months", "location", "expires_on", "message",
            "status", "is_expired", "response_note", "created_at", "responded_at", "company_name", "candidate_name",
        ]
        read_only_fields = ["id", "status", "response_note", "created_at", "responded_at"]

    def get_candidate_name(self, obj):
        return _name(obj.application.student.user)

    def validate(self, attrs):
        start, expires = attrs.get("start_date"), attrs.get("expires_on")
        from django.utils import timezone

        if expires and expires < timezone.localdate():
            raise serializers.ValidationError({"expires_on": "The reply-by date can't be in the past."})
        if start and expires and expires > start:
            raise serializers.ValidationError({"expires_on": "Ask for a reply before the start date."})
        return attrs


class FeedbackSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_id = serializers.IntegerField(source="author.id", read_only=True)

    class Meta:
        model = InterviewFeedback
        fields = ["id", "author_id", "author_name", "technical", "communication", "culture", "recommendation", "comments", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_author_name(self, obj):
        return _name(obj.author)

    def validate(self, attrs):
        for f in ("technical", "communication", "culture"):
            if f in attrs and not 1 <= attrs[f] <= 5:
                raise serializers.ValidationError({f: "Score from 1 to 5."})
        return attrs


class InterviewSerializer(serializers.ModelSerializer):
    """Recruiter view of an interview."""

    interviewer_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    interviewers = serializers.SerializerMethodField()
    feedback = FeedbackSerializer(many=True, read_only=True)
    candidate_name = serializers.SerializerMethodField()
    internship_title = serializers.CharField(source="application.internship.title", read_only=True)
    application_id = serializers.IntegerField(source="application.id", read_only=True)

    class Meta:
        model = Interview
        fields = [
            "id", "application_id", "round_name", "scheduled_at", "duration_minutes", "mode", "meeting_link", "location",
            "instructions", "status", "candidate_response", "candidate_note", "interviewers", "interviewer_ids",
            "feedback", "candidate_name", "internship_title", "created_at",
        ]
        read_only_fields = ["id", "candidate_response", "candidate_note", "created_at"]

    def get_interviewers(self, obj):
        return [{"id": u.id, "name": _name(u)} for u in obj.interviewers.all()]

    def get_candidate_name(self, obj):
        return _name(obj.application.student.user)

    def validate(self, attrs):
        mode = attrs.get("mode", getattr(self.instance, "mode", "video"))
        link = attrs.get("meeting_link", getattr(self.instance, "meeting_link", ""))
        place = attrs.get("location", getattr(self.instance, "location", ""))
        if mode == "video" and not link:
            raise serializers.ValidationError({"meeting_link": "Add the meeting link (Google Meet, Zoom…)."})
        if mode == "onsite" and not place:
            raise serializers.ValidationError({"location": "Add the address."})
        d = attrs.get("duration_minutes")
        if d is not None and not 10 <= d <= 480:
            raise serializers.ValidationError({"duration_minutes": "Between 10 minutes and 8 hours."})
        return attrs


class StudentInterviewSerializer(serializers.ModelSerializer):
    """What the candidate sees — no scorecards, no panel emails."""

    class Meta:
        model = Interview
        fields = [
            "id", "round_name", "scheduled_at", "duration_minutes", "mode", "meeting_link", "location",
            "instructions", "status", "candidate_response", "candidate_note",
        ]


class EventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = ApplicationEvent
        fields = ["id", "kind", "from_status", "to_status", "detail", "actor_name", "created_at"]

    def get_actor_name(self, obj):
        return _name(obj.actor) if obj.actor else "CareerBridge"


class NoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_id = serializers.IntegerField(source="author.id", read_only=True, default=None)

    class Meta:
        model = ApplicationNote
        fields = ["id", "body", "author_id", "author_name", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_author_name(self, obj):
        return _name(obj.author)


class EmailTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailTemplate
        fields = ["id", "name", "subject", "body", "created_at"]
        read_only_fields = ["id", "created_at"]


# ── Student side ────────────────────────────────────────────────────────────

class ApplicationSerializer(serializers.ModelSerializer):
    internship = InternshipListSerializer(read_only=True)
    internship_id = serializers.PrimaryKeyRelatedField(
        queryset=Internship.objects.all(), source="internship", write_only=True,
    )
    answers = serializers.ListField(child=serializers.DictField(), required=False)
    interviews = serializers.SerializerMethodField()
    offer = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = [
            "id", "internship", "internship_id", "status", "source", "answers",
            "cover_letter", "applied_at", "updated_at", "interviews", "offer",
        ]
        read_only_fields = ["id", "status", "source", "applied_at", "updated_at"]

    def get_interviews(self, obj):
        live = [i for i in obj.interviews.all() if i.status != "cancelled"]
        return StudentInterviewSerializer(live, many=True).data

    def get_offer(self, obj):
        offer = getattr(obj, "offer", None)
        if offer is None or offer.status == "withdrawn":
            return None
        return OfferSerializer(offer).data


class StudentApplicationDetailSerializer(ApplicationSerializer):
    timeline = serializers.SerializerMethodField()

    class Meta(ApplicationSerializer.Meta):
        fields = ApplicationSerializer.Meta.fields + ["timeline"]

    def get_timeline(self, obj):
        events = [e for e in obj.events.all() if not e.internal]
        return EventSerializer(events, many=True).data


# ── Recruiter side ──────────────────────────────────────────────────────────

class _RecruiterBase(serializers.ModelSerializer):
    avg_rating = serializers.SerializerMethodField()
    my_rating = serializers.SerializerMethodField()
    match_score = serializers.SerializerMethodField()
    internship = serializers.SerializerMethodField()

    def get_avg_rating(self, obj):
        stars = [r.stars for r in obj.ratings.all()]
        return round(sum(stars) / len(stars), 1) if stars else None

    def get_my_rating(self, obj):
        me = self.context.get("request").user
        return next((r.stars for r in obj.ratings.all() if r.author_id == me.id), None)

    def get_match_score(self, obj):
        return match_for(obj)["score"]

    def get_internship(self, obj):
        return {"id": obj.internship_id, "title": obj.internship.title}


class RecruiterApplicationRowSerializer(_RecruiterBase):
    """One card on the pipeline board / one row in the applicants table."""

    student = serializers.SerializerMethodField()
    next_interview = serializers.SerializerMethodField()
    offer_status = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = [
            "id", "status", "source", "tags", "applied_at", "status_changed_at", "viewed_at", "cover_letter",
            "recruiter_notes", "avg_rating", "my_rating", "match_score", "internship", "student",
            "next_interview", "offer_status",
        ]

    def get_student(self, obj):
        s = obj.student
        photo = s.user.profile_photo.url if s.user.profile_photo else None
        return {
            "id": s.id, "user_name": _name(s.user), "user_email": s.user.email, "photo": photo,
            "university": {"name": s.university.name} if s.university else None,
            "degree": s.degree, "branch": s.branch, "cgpa": s.cgpa, "graduation_year": s.graduation_year,
            "verification_status": s.verification_status,
        }

    def get_next_interview(self, obj):
        from django.utils import timezone

        upcoming = [i for i in obj.interviews.all() if i.status == "scheduled" and i.scheduled_at >= timezone.now()]
        if not upcoming:
            return None
        i = min(upcoming, key=lambda x: x.scheduled_at)
        return {"id": i.id, "scheduled_at": i.scheduled_at, "round_name": i.round_name, "candidate_response": i.candidate_response}

    def get_offer_status(self, obj):
        offer = getattr(obj, "offer", None)
        if offer is None:
            return None
        return "expired" if offer.is_expired else offer.status


class RecruiterApplicationDetailSerializer(_RecruiterBase):
    """Everything about one candidate on one screen."""

    student = StudentProfileSerializer(read_only=True)
    skills = serializers.SerializerMethodField()
    experiences = serializers.SerializerMethodField()
    certifications = serializers.SerializerMethodField()
    achievements = serializers.SerializerMethodField()
    match = serializers.SerializerMethodField()
    notes = NoteSerializer(many=True, read_only=True)
    ratings = serializers.SerializerMethodField()
    events = EventSerializer(many=True, read_only=True)
    interviews = InterviewSerializer(many=True, read_only=True)
    offer = serializers.SerializerMethodField()
    internship = serializers.SerializerMethodField()
    student_photo = serializers.ImageField(source="student.user.profile_photo", read_only=True)
    student_phone = serializers.CharField(source="student.user.phone", read_only=True)

    class Meta:
        model = Application
        fields = [
            "id", "status", "source", "tags", "answers", "cover_letter", "recruiter_notes", "applied_at",
            "status_changed_at", "viewed_at", "avg_rating", "my_rating", "match_score", "match", "internship",
            "student", "student_photo", "student_phone", "skills", "experiences", "certifications", "achievements",
            "notes", "ratings", "events", "interviews", "offer",
        ]

    def get_internship(self, obj):
        i = obj.internship
        return {"id": i.id, "title": i.title, "stipend": i.stipend, "duration_months": i.duration_months, "location": i.location}

    def get_skills(self, obj):
        return [{"name": ss.skill.name, "proficiency": ss.proficiency} for ss in obj.student.student_skills.all()]

    def get_experiences(self, obj):
        return ExperienceSerializer(obj.student.experiences.all(), many=True).data

    def get_certifications(self, obj):
        return CertificationSerializer(obj.student.certifications.all(), many=True, context=self.context).data

    def get_achievements(self, obj):
        return AchievementSerializer(obj.student.achievements.all(), many=True).data

    def get_match(self, obj):
        return match_for(obj)

    def get_ratings(self, obj):
        return [{"author_name": _name(r.author), "stars": r.stars} for r in obj.ratings.all()]

    def get_offer(self, obj):
        offer = getattr(obj, "offer", None)
        return OfferSerializer(offer).data if offer else None


class ApplicationStatusUpdateSerializer(serializers.ModelSerializer):
    """Recruiter updates status and notes."""
    class Meta:
        model = Application
        fields = ["status", "recruiter_notes"]


# Old name, still used by older imports.
ApplicationDetailSerializer = RecruiterApplicationRowSerializer
