"""Tests for the university placement cell."""

from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from applications.models import Application
from institutions.models import Company, CompanyMembership, StudentProfile, University
from internships.models import Internship
from notifications.models import Notification


def make_user(username, role):
    return User.objects.create_user(username=username, password="pw-123456", email=f"{username}@example.com", role=role,
                                    first_name=username.title())


@override_settings(BREVO_API_KEY="", EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class PlacementCellTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.officer = make_user("tpo", "university")
        self.uni = University.objects.create(name="Lovely University")
        self.good = StudentProfile.objects.create(user=make_user("asha", "student"), university=self.uni, branch="CSE",
                                                  cgpa="8.5", graduation_year=2027)
        self.weak = StudentProfile.objects.create(user=make_user("bala", "student"), university=self.uni, branch="Civil",
                                                  cgpa="6.1", graduation_year=2027)
        StudentProfile.objects.create(user=make_user("elsewhere", "student"), university=University.objects.create(name="Other"))
        self.company = Company.objects.create(name="Acme")
        CompanyMembership.objects.create(user=make_user("hr", "company"), company=self.company)
        self.internship = Internship.objects.create(company=self.company, title="SDE Intern", description="x", status="published",
                                                    deadline=timezone.localdate() + timedelta(days=20))

    def link(self):
        self.api.force_authenticate(self.officer)
        r = self.api.post("/api/campus/my-university/", {"university_id": self.uni.id, "title": "TPO"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertTrue(r.json()["is_admin"])

    def test_students_are_scoped_and_verifiable(self):
        self.assertEqual(self.client.get("/api/campus/students/").status_code, 401)
        self.link()
        rows = self.api.get("/api/campus/students/").json()["results"]
        self.assertEqual({r["name"] for r in rows}, {"Asha", "Bala"})

        r = self.api.post(f"/api/campus/students/{self.good.id}/verify/", {"status": "verified"}, format="json")
        self.assertEqual(r.json()["verification_status"], "verified")
        self.assertTrue(Notification.objects.filter(user=self.good.user, kind="verification").exists())
        r = self.api.post(f"/api/campus/students/{self.weak.id}/verify/", {"status": "rejected"}, format="json")
        self.assertEqual(r.status_code, 400)  # needs a note

        # the student editing their CGPA resets verification
        self.api.force_authenticate(self.good.user)
        self.api.patch("/api/institutions/student-profile/", {"cgpa": "9.9"}, format="json")
        self.good.refresh_from_db()
        self.assertEqual(self.good.verification_status, "unverified")

    def test_drive_registration_applies_and_reports(self):
        self.link()
        r = self.api.post("/api/campus/drives/", {
            "title": "Acme SDE drive", "company": self.company.id, "internship": self.internship.id,
            "drive_date": (timezone.now() + timedelta(days=5)).isoformat(), "min_cgpa": "7.0", "allowed_branches": "CSE, IT",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        drive_id = r.json()["id"]
        self.assertTrue(Notification.objects.filter(user=self.good.user, kind="drive").exists())
        self.assertFalse(Notification.objects.filter(user=self.weak.user, kind="drive").exists())

        self.api.force_authenticate(self.good.user)
        campus = self.api.get("/api/campus/student/").json()
        self.assertTrue(campus["drives"][0]["eligible"])
        r = self.api.post(f"/api/campus/student/drives/{drive_id}/register/")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.json()["applied"])
        self.assertEqual(Application.objects.get(student=self.good).source, "drive")

        self.api.force_authenticate(self.weak.user)
        self.assertEqual(self.api.post(f"/api/campus/student/drives/{drive_id}/register/").status_code, 400)

        Application.objects.filter(student=self.good).update(status="selected")
        self.api.force_authenticate(self.officer)
        report = self.api.get("/api/campus/reports/").json()
        self.assertEqual(report["students_placed"], 1)
        self.assertEqual(report["placement_rate"], 50.0)
        self.assertEqual(report["top_recruiters"][0]["company"], "Acme")
        self.assertEqual(self.api.get("/api/campus/reports/export/").status_code, 200)
        detail = self.api.get(f"/api/campus/drives/{drive_id}/").json()
        self.assertEqual(len(detail["registrations"]), 1)

    def test_announcement_reaches_students(self):
        self.link()
        r = self.api.post("/api/campus/announcements/", {"title": "Resume workshop", "body": "Friday 3pm"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Notification.objects.filter(kind="announcement").count(), 2)
        self.api.force_authenticate(self.good.user)
        self.assertEqual(self.api.get("/api/campus/student/").json()["announcements"][0]["title"], "Resume workshop")
        n = self.api.get("/api/notifications/").json()
        self.assertGreaterEqual(n["unread"], 1)
        self.api.post("/api/notifications/read/", {}, format="json")
        self.assertEqual(self.api.get("/api/notifications/").json()["unread"], 0)


class AdminChainTests(TestCase):
    """Placement-cell admins form a chain: you can only change or remove admins at your level or below."""

    def setUp(self):
        from institutions.models import UniversityStaff

        self.uni = University.objects.create(name="Chain University")

        def staff(name, admin=False, rank=None):
            return UniversityStaff.objects.create(user=make_user(name, "university"), university=self.uni, is_admin=admin, admin_rank=rank)

        self.a, self.b, self.c, self.d = staff("head", True, 0), staff("bina"), staff("chirag"), staff("dev")

    def act(self, who, target, method="PATCH", is_admin=None):
        api = APIClient()
        api.force_authenticate(who.user)
        url = f"/api/campus/my-university/staff/{target.pk}/"
        return api.delete(url) if method == "DELETE" else api.patch(url, {"is_admin": is_admin}, format="json")

    def test_chain_of_command(self):
        self.assertEqual(self.act(self.a, self.b, is_admin=True).status_code, 200)  # head makes bina admin
        self.assertEqual(self.act(self.b, self.c, is_admin=True).status_code, 200)  # bina makes chirag admin
        self.assertEqual(self.act(self.b, self.d, is_admin=True).status_code, 200)  # ...and dev
        for s in (self.b, self.c, self.d):
            s.refresh_from_db()
        self.assertEqual((self.b.admin_rank, self.c.admin_rank, self.d.admin_rank), (1, 2, 2))
        self.assertEqual(self.c.made_admin_by, self.b)
        # nobody can touch someone above them: not the head, not the person who made them admin
        self.assertEqual(self.act(self.b, self.a, is_admin=False).status_code, 403)
        self.assertEqual(self.act(self.b, self.a, method="DELETE").status_code, 403)
        self.assertEqual(self.act(self.c, self.b, is_admin=False).status_code, 403)
        # same level and below are fine
        self.assertEqual(self.act(self.c, self.d, is_admin=False).status_code, 200)
        self.assertEqual(self.act(self.a, self.b, is_admin=False).status_code, 200)
        # you can always step down yourself, unless you're the last admin
        self.assertEqual(self.act(self.c, self.c, is_admin=False).status_code, 200)
        self.assertEqual(self.act(self.a, self.a, is_admin=False).status_code, 400)
