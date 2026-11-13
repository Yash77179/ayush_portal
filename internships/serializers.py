"""Serializers for internships app."""

from django.db import transaction
from rest_framework import serializers
from .models import Skill, StudentSkill, Internship, InternshipSkill, ScreeningQuestion
from institutions.serializers import CompanySerializer


class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ["id", "name", "category"]


class StudentSkillSerializer(serializers.ModelSerializer):
    skill = SkillSerializer(read_only=True)
    skill_id = serializers.PrimaryKeyRelatedField(
        queryset=Skill.objects.all(), source="skill", write_only=True
    )

    class Meta:
        model = StudentSkill
        fields = ["id", "skill", "skill_id", "proficiency"]


class InternshipSkillSerializer(serializers.ModelSerializer):
    skill = SkillSerializer(read_only=True)

    class Meta:
        model = InternshipSkill
        fields = ["skill", "is_required"]


class ScreeningQuestionPublicSerializer(serializers.ModelSerializer):
    """What students see — never the knockout answer."""

    class Meta:
        model = ScreeningQuestion
        fields = ["id", "text", "kind", "choices", "required"]


class ScreeningQuestionSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = ScreeningQuestion
        fields = ["id", "text", "kind", "choices", "required", "knockout_answer", "order"]

    def validate(self, attrs):
        kind = attrs.get("kind", "text")
        choices = [str(c).strip() for c in attrs.get("choices") or [] if str(c).strip()]
        if kind == "choice" and len(choices) < 2:
            raise serializers.ValidationError({"choices": "Give at least two options."})
        attrs["choices"] = choices if kind == "choice" else (["Yes", "No"] if kind == "yesno" else [])
        knock = attrs.get("knockout_answer", "").strip()
        if knock and kind == "text":
            knock = ""
        if knock and knock.lower() not in {c.lower() for c in attrs["choices"]}:
            raise serializers.ValidationError({"knockout_answer": "The required answer must be one of the options."})
        attrs["knockout_answer"] = knock
        return attrs




ELIGIBILITY_FIELDS = ["min_cgpa", "allowed_branches", "allowed_degrees", "graduation_year_min", "graduation_year_max"]


class InternshipListSerializer(serializers.ModelSerializer):
    company_id = serializers.IntegerField(source="company.id", read_only=True)
    company_name = serializers.CharField(source="company.name", read_only=True)
    company_logo = serializers.ImageField(source="company.logo", read_only=True)
    skills_count = serializers.SerializerMethodField()

    class Meta:
        model = Internship
        fields = [
            "id", "title", "company_id", "company_name", "company_logo", "location",
            "work_mode", "stipend", "duration_months", "deadline",
            "status", "openings", "skills_count", "created_at",
        ]

    def get_skills_count(self, obj):
        return obj.internship_skills.filter(is_required=True).count()


class CompanyInternshipRowSerializer(InternshipListSerializer):
    """The recruiter's own listings, with how many people applied and are still in play."""

    applicants = serializers.IntegerField(read_only=True)
    active_applicants = serializers.IntegerField(read_only=True)

    class Meta(InternshipListSerializer.Meta):
        fields = InternshipListSerializer.Meta.fields + ["applicants", "active_applicants"]


class InternshipDetailSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    internship_skills = InternshipSkillSerializer(many=True, read_only=True)
    screening_questions = ScreeningQuestionPublicSerializer(many=True, read_only=True)

    class Meta:
        model = Internship
        fields = [
            "id", "title", "company", "description", "location", "work_mode",
            "stipend", "duration_months", "openings", "deadline", "status",
            "internship_skills", "screening_questions", *ELIGIBILITY_FIELDS, "created_at", "updated_at",
        ]


class SkillChoiceSerializer(serializers.Serializer):
    skill_id = serializers.PrimaryKeyRelatedField(queryset=Skill.objects.all(), source="skill")
    is_required = serializers.BooleanField(default=True)


class InternshipManageSerializer(serializers.ModelSerializer):
    """Create / edit a listing including its skills, eligibility rules and screening questions."""

    skills = SkillChoiceSerializer(many=True, required=False, write_only=True)
    questions = ScreeningQuestionSerializer(many=True, required=False, write_only=True)
    internship_skills = InternshipSkillSerializer(many=True, read_only=True)
    screening_questions = ScreeningQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Internship
        fields = [
            "id", "title", "description", "location", "work_mode", "stipend",
            "duration_months", "openings", "deadline", "status", *ELIGIBILITY_FIELDS,
            "skills", "questions", "internship_skills", "screening_questions", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        lo = attrs.get("graduation_year_min", getattr(self.instance, "graduation_year_min", None))
        hi = attrs.get("graduation_year_max", getattr(self.instance, "graduation_year_max", None))
        if lo and hi and lo > hi:
            raise serializers.ValidationError({"graduation_year_max": "The last year can't be before the first."})
        cgpa = attrs.get("min_cgpa")
        if cgpa is not None and not (0 <= cgpa <= 10):
            raise serializers.ValidationError({"min_cgpa": "CGPA is on a 0–10 scale."})
        return attrs

    def _save_children(self, internship, skills, questions):
        if skills is not None:
            internship.internship_skills.all().delete()
            seen = set()
            for s in skills:
                if s["skill"].pk in seen:
                    continue
                seen.add(s["skill"].pk)
                InternshipSkill.objects.create(internship=internship, skill=s["skill"], is_required=s["is_required"])
        if questions is not None:
            internship.screening_questions.all().delete()
            for i, q in enumerate(questions):
                q.pop("id", None)
                q["order"] = i
                ScreeningQuestion.objects.create(internship=internship, **q)

    @transaction.atomic
    def create(self, validated_data):
        skills = validated_data.pop("skills", None)
        questions = validated_data.pop("questions", None)
        internship = super().create(validated_data)
        self._save_children(internship, skills, questions)
        return internship

    @transaction.atomic
    def update(self, instance, validated_data):
        skills = validated_data.pop("skills", None)
        questions = validated_data.pop("questions", None)
        internship = super().update(instance, validated_data)
        self._save_children(internship, skills, questions)
        return internship


# Kept for anything importing the old name.
InternshipCreateSerializer = InternshipManageSerializer
