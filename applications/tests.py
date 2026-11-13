"""End-to-end tests for the recruiter hiring system (ATS)."""

from datetime import timedelta

from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from institutions.models import CompanyMembership, StudentProfile, University
from internships.models import Internship, InternshipSkill, Skill, StudentSkill
from notifications.models import Notification

from .models import Application, ApplicationEvent


def make_user(username, role, **kw):
    return User.objects.create_user(username=username, password="pw-123456", email=f"{username}@example.com", role=role,
                                    first_name=username.title(), **kw)


@override_settings(BREVO_API_KEY="", EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class HiringFlowTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.recruiter = make_user("rita", "company")
        self.interviewer = make_user("ivan", "company")
        self.student = make_user("sam", "student")
        self.uni = University.objects.create(name="Test University")
        self.profile = StudentProfile.objects.create(user=self.student, university=self.uni, degree="B.Tech", branch="CSE",
                                                     cgpa="8.20", graduation_year=2027)
        python = Skill.objects.create(name="Python")
        StudentSkill.objects.create(student=self.profile, skill=python)

        # recruiter sets up the company, then adds an interviewer
        self.api.force_authenticate(self.recruiter)
        r = self.api.post("/api/institutions/my-company/", {"name": "Nova Tech", "industry": "Software"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["role"], "admin")
        r = self.api.post("/api/institutions/my-company/team/", {"email": "ivan@example.com", "role": "interviewer"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)

        r = self.api.post("/api/internships/my/", {
            "title": "Backend Intern", "description": "Build APIs", "location": "Pune", "work_mode": "hybrid",
            "stipend": "20000", "duration_months": 3, "openings": 2, "status": "published",
            "deadline": str(timezone.localdate() + timedelta(days=10)),
            "min_cgpa": "7.5", "allowed_branches": "CSE, IT",
            "skills": [{"skill_id": python.id, "is_required": True}],
            "questions": [
                {"text": "Can you work from Pune?", "kind": "yesno", "required": True, "knockout_answer": "Yes"},
                {"text": "Why us?", "kind": "text", "required": False},
            ],
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.internship = Internship.objects.get(pk=r.json()["id"])
        self.assertEqual(self.internship.screening_questions.count(), 2)
        self.assertTrue(InternshipSkill.objects.filter(internship=self.internship, skill=python).exists())
        self.q_pune = self.internship.screening_questions.get(kind="yesno")

    def apply(self, answer="Yes", user=None):
        self.api.force_authenticate(user or self.student)
        return self.api.post("/api/applications/", {
            "internship_id": self.internship.id, "cover_letter": "Hi",
            "answers": [{"question_id": self.q_pune.id, "answer": answer}],
        }, format="json")

    def test_full_pipeline(self):
        r = self.apply()
        self.assertEqual(r.status_code, 201, r.content)
        app_id = r.json()["id"]
        self.assertTrue(Notification.objects.filter(user=self.recruiter, kind="applicant").exists())

        # board + candidate view
        self.api.force_authenticate(self.recruiter)
        board = self.api.get("/api/applications/recruiter/").json()
        self.assertEqual(board[0]["match_score"], 100)
        detail = self.api.get(f"/api/applications/recruiter/{app_id}/").json()
        self.assertEqual(detail["answers"][0]["answer"], "Yes")
        self.assertIsNotNone(Application.objects.get(pk=app_id).viewed_at)

        # notes, ratings, tags
        self.assertEqual(self.api.post(f"/api/applications/recruiter/{app_id}/notes/", {"body": "Solid"}, format="json").status_code, 201)
        self.assertEqual(self.api.put(f"/api/applications/recruiter/{app_id}/rating/", {"stars": 4}, format="json").json()["avg_rating"], 4)
        self.assertEqual(self.api.put(f"/api/applications/recruiter/{app_id}/tags/", {"tags": ["strong DSA", "strong dsa"]}, format="json").json()["tags"], ["strong DSA"])

        # move stage → student notified by email
        mail.outbox.clear()
        r = self.api.patch(f"/api/applications/recruiter/{app_id}/status/", {"status": "shortlisted"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["sam@example.com"])

        # interviewer may look and score but not move
        self.api.force_authenticate(self.interviewer)
        self.assertEqual(self.api.get(f"/api/applications/recruiter/{app_id}/").status_code, 200)
        self.assertEqual(self.api.patch(f"/api/applications/recruiter/{app_id}/status/", {"status": "rejected"}, format="json").status_code, 403)

        # schedule interview with .ics
        self.api.force_authenticate(self.recruiter)
        mail.outbox.clear()
        when = (timezone.now() + timedelta(days=2)).isoformat()
        r = self.api.post(f"/api/applications/recruiter/{app_id}/interviews/", {
            "round_name": "Technical", "scheduled_at": when, "duration_minutes": 45, "mode": "video",
            "meeting_link": "https://meet.google.com/abc", "interviewer_ids": [self.interviewer.id],
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        interview_id = r.json()["id"]
        self.assertEqual(Application.objects.get(pk=app_id).status, "interview")
        student_mail = next(m for m in mail.outbox if m.to == ["sam@example.com"])
        self.assertEqual(student_mail.attachments[0][0], "interview.ics")
        self.assertIn(b"BEGIN:VCALENDAR", student_mail.attachments[0][1] if isinstance(student_mail.attachments[0][1], bytes) else student_mail.attachments[0][1].encode())

        # student confirms; interviewer files a scorecard
        self.api.force_authenticate(self.student)
        r = self.api.post(f"/api/applications/interviews/{interview_id}/respond/", {"response": "confirmed"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.api.get(f"/api/applications/interviews/{interview_id}/ics/").status_code, 200)
        self.api.force_authenticate(self.interviewer)
        r = self.api.post(f"/api/applications/recruiter/interviews/{interview_id}/feedback/", {
            "technical": 5, "communication": 4, "culture": 4, "recommendation": "yes",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)

        # offer → accept → hired
        self.api.force_authenticate(self.recruiter)
        r = self.api.post(f"/api/applications/recruiter/{app_id}/offer/", {
            "start_date": str(timezone.localdate() + timedelta(days=30)),
            "expires_on": str(timezone.localdate() + timedelta(days=7)),
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        offer_id = r.json()["id"]
        self.assertEqual(r.json()["role_title"], "Backend Intern")
        self.assertEqual(Application.objects.get(pk=app_id).status, "offered")

        self.api.force_authenticate(self.student)
        mine = self.api.get("/api/applications/").json()
        self.assertEqual(mine[0]["offer"]["id"], offer_id)
        self.assertEqual(self.api.get(f"/api/applications/offers/{offer_id}/").status_code, 200)
        r = self.api.post(f"/api/applications/offers/{offer_id}/respond/", {"decision": "accept"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Application.objects.get(pk=app_id).status, "selected")
        timeline = self.api.get(f"/api/applications/{app_id}/").json()["timeline"]
        self.assertFalse(any(e["kind"] in ("note", "rated", "tagged", "feedback") for e in timeline))

        # analytics + export
        self.api.force_authenticate(self.recruiter)
        stats = self.api.get("/api/applications/recruiter/analytics/").json()
        hired = next(f for f in stats["funnel"] if f["stage"] == "selected")
        self.assertEqual(hired["count"], 1)
        self.assertIsNotNone(stats["time_to_hire_days"])
        self.assertEqual(stats["offers"]["accepted"], 1)
        csv = self.api.get("/api/applications/recruiter/export/")
        self.assertEqual(csv.status_code, 200)
        self.assertIn("Sam", csv.content.decode("utf-8-sig"))

    def test_knockout_and_eligibility(self):
        r = self.apply(answer="No")
        self.assertEqual(r.status_code, 201)
        app = Application.objects.get(pk=r.json()["id"])
        self.assertEqual(app.status, "rejected")
        self.assertTrue(app.events.filter(kind=ApplicationEvent.Kind.KNOCKOUT).exists())

        low = make_user("lou", "student")
        StudentProfile.objects.create(user=low, branch="Mechanical", cgpa="6.0")
        r = self.apply(user=low)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(len(r.json()["eligibility"]), 2)

    def test_bulk_and_other_company_isolation(self):
        app_id = self.apply().json()["id"]
        self.api.force_authenticate(self.recruiter)
        r = self.api.post("/api/applications/recruiter/bulk/", {"ids": [app_id], "action": "tag", "tag": "campus"}, format="json")
        self.assertEqual(r.json()["updated"], 1)
        r = self.api.post("/api/applications/recruiter/bulk/", {"ids": [app_id], "action": "move", "status": "review"}, format="json")
        self.assertEqual(Application.objects.get(pk=app_id).status, "review")

        outsider = make_user("otto", "company")
        self.api.force_authenticate(outsider)
        self.assertEqual(self.api.post("/api/institutions/my-company/", {"name": "nova tech"}, format="json").status_code, 400)
        self.api.post("/api/institutions/my-company/", {"name": "Other Co"}, format="json")
        self.assertEqual(self.api.get(f"/api/applications/recruiter/{app_id}/").status_code, 404)
        self.assertEqual(self.api.get("/api/applications/recruiter/").json(), [])

    def test_last_admin_is_protected(self):
        self.api.force_authenticate(self.recruiter)
        me = CompanyMembership.objects.get(user=self.recruiter)
        r = self.api.patch(f"/api/institutions/my-company/team/{me.id}/", {"role": "recruiter"}, format="json")
        self.assertEqual(r.status_code, 400)
