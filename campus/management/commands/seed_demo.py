"""Demo data for the recruiter and university portals, so a walkthrough never starts empty.

    python manage.py seed_demo            # create (safe to re-run: skips what already exists)
    python manage.py seed_demo --reset    # delete the demo accounts and everything they own, then recreate

Every demo account uses the password  Demo@12345
    demo_recruiter   company admin at Nova Tech
    demo_interviewer interviewer at Nova Tech
    demo_tpo         placement-cell admin at Demo Institute of Technology
    demo_student1…12 students (demo_student1 has an interview and an offer waiting)
"""

import random
from datetime import timedelta

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from applications import services
from applications.models import Application, ApplicationNote, ApplicationRating, Interview, InterviewFeedback, Offer
from campus.models import Announcement, DriveRegistration, PlacementDrive
from institutions.models import Company, CompanyMembership, StudentProfile, University, UniversityStaff
from internships.models import Internship, InternshipSkill, ScreeningQuestion, Skill, StudentSkill

PASSWORD = "Demo@12345"
UNIVERSITY = "Demo Institute of Technology"
COMPANY = "Nova Tech"

STUDENTS = [
    ("Ananya", "Iyer", "CSE", "8.9", ["Python", "Django", "React", "SQL"]),
    ("Rohan", "Mehta", "CSE", "7.8", ["JavaScript", "React", "Node.js"]),
    ("Ishita", "Kapoor", "IT", "9.2", ["Python", "Django", "Docker", "PostgreSQL"]),
    ("Kabir", "Singh", "ECE", "7.1", ["C++", "Python"]),
    ("Meera", "Nair", "CSE", "8.4", ["React", "TypeScript", "Figma"]),
    ("Arjun", "Rao", "IT", "6.6", ["Java", "SQL"]),
    ("Sneha", "Patil", "CSE", "8.1", ["Python", "Pandas", "SQL", "Power BI"]),
    ("Vikram", "Joshi", "Mechanical", "7.4", ["MATLAB", "Excel"]),
    ("Priya", "Sharma", "CSE", "9.0", ["Python", "Machine Learning", "PyTorch"]),
    ("Aditya", "Verma", "IT", "7.9", ["JavaScript", "Next.js", "Tailwind CSS"]),
    ("Neha", "Gupta", "ECE", "8.3", ["Python", "Data Analysis"]),
    ("Rahul", "Das", "CSE", "7.2", ["Java", "Spring", "SQL"]),
]

# (title, skills, stage plan for students by index)
LISTINGS = [
    ("Backend Engineer Intern", ["Python", "Django", "SQL", "Docker"], 20000, "Pune"),
    ("Frontend Developer Intern", ["React", "TypeScript", "JavaScript"], 18000, "Bengaluru"),
    ("Data Analyst Intern", ["Python", "SQL", "Pandas"], 15000, "Remote"),
]
PLAN = {  # student index -> (listing index, final stage)
    0: (0, "offered"), 1: (1, "interview"), 2: (0, "selected"), 3: (0, "rejected"), 4: (1, "shortlisted"),
    5: (0, "applied"), 6: (2, "review"), 8: (2, "interview"), 9: (1, "applied"), 10: (2, "applied"), 11: (0, "review"),
}
PATH = ["applied", "review", "shortlisted", "interview", "offered", "selected"]


def user(username, role, first, last):
    u, created = User.objects.get_or_create(
        username=username,
        defaults={"role": role, "first_name": first, "last_name": last, "email": f"{username}@demo.careerbridge.local"},
    )
    if created:
        u.set_password(PASSWORD)
        u.save()
    return u


class Command(BaseCommand):
    help = "Create demo data for the recruiter (ATS) and university (placement cell) portals."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete existing demo data first.")

    @transaction.atomic
    def handle(self, *args, reset=False, **opts):
        rnd = random.Random(7)
        if reset:
            User.objects.filter(username__startswith="demo_").delete()
            Company.objects.filter(name=COMPANY).delete()
            University.objects.filter(name=UNIVERSITY).delete()
        if not Skill.objects.exists():
            call_command("seed_skills")
        skill = {s.name: s for s in Skill.objects.all()}
        now = timezone.now()

        # organisations and their people
        uni, _ = University.objects.get_or_create(name=UNIVERSITY, defaults={"location": "Phagwara, Punjab"})
        tpo = user("demo_tpo", "university", "Kavita", "Rao")
        UniversityStaff.objects.get_or_create(user=tpo, defaults={"university": uni, "is_admin": True, "title": "Training & Placement Officer"})

        company, _ = Company.objects.get_or_create(
            name=COMPANY,
            defaults={
                "industry": "Software", "size": "small", "location": "Bengaluru", "website": "https://novatech.example",
                "description": "Nova Tech builds hiring and analytics software for fast-growing teams.",
                "culture": "Small teams, real ownership, a mentor for every intern and demo day every Friday.",
                "is_verified": True, "founded_year": 2016,
            },
        )
        recruiter = user("demo_recruiter", "company", "Riya", "Menon")
        interviewer = user("demo_interviewer", "company", "Imran", "Khan")
        CompanyMembership.objects.get_or_create(user=recruiter, company=company, defaults={"role": "admin"})
        CompanyMembership.objects.get_or_create(user=interviewer, company=company, defaults={"role": "interviewer"})

        # listings
        listings = []
        for title, skills, stipend, city in LISTINGS:
            i, created = Internship.objects.get_or_create(
                company=company, title=title,
                defaults={
                    "description": f"Join the {title.split()[0].lower()} team.\n\nWhat you'll do\n- Ship features with a mentor\n- Review code\n- Demo your work every week",
                    "location": city, "work_mode": "remote" if city == "Remote" else "hybrid", "stipend": stipend,
                    "duration_months": 6, "openings": 2, "deadline": timezone.localdate() + timedelta(days=21),
                    "status": "published", "posted_by": recruiter, "min_cgpa": "7.0",
                },
            )
            if created:
                for n, name in enumerate(skills):
                    if name in skill:
                        InternshipSkill.objects.create(internship=i, skill=skill[name], is_required=n < 3)
                ScreeningQuestion.objects.create(internship=i, text="Can you work for 6 months starting January?", kind="yesno", knockout_answer="Yes")
            listings.append(i)

        # students
        profiles = []
        for n, (first, last, branch, cgpa, skills) in enumerate(STUDENTS, start=1):
            u = user(f"demo_student{n}", "student", first, last)
            p, created = StudentProfile.objects.get_or_create(
                user=u,
                defaults={
                    "university": uni, "degree": "B.Tech", "branch": branch, "cgpa": cgpa, "graduation_year": 2027,
                    "enrollment_number": f"1211{n:04d}", "bio": f"{branch} student who enjoys building things.",
                    "verification_status": "verified" if n % 3 else "unverified",
                },
            )
            if created:
                for name in skills:
                    if name in skill:
                        StudentSkill.objects.create(student=p, skill=skill[name], proficiency=rnd.choice(["beginner", "intermediate", "advanced"]))
            profiles.append(p)

        # applications walked through the pipeline, with a believable history
        for idx, (li, final) in PLAN.items():
            p, internship = profiles[idx], listings[li]
            if Application.objects.filter(student=p, internship=internship).exists():
                continue
            start = now - timedelta(days=rnd.randint(8, 20))
            app = Application.objects.create(
                student=p, internship=internship, cover_letter="I'd love to learn from your team.",
                answers=[{"question_id": internship.screening_questions.first().id, "question": "Can you work for 6 months starting January?", "answer": "Yes"}],
            )
            Application.objects.filter(pk=app.pk).update(applied_at=start)
            services.log(app, "applied", p.user, to_status="applied")
            app.events.filter(kind="applied").update(created_at=start)
            stages = ["review", "rejected"] if final == "rejected" else PATH[1 : PATH.index(final) + 1]
            t = start
            for st in stages:
                t += timedelta(days=rnd.randint(1, 3))
                services.move(app, st, recruiter, notify_student=False)
                app.events.filter(kind="moved", to_status=st).update(created_at=t)
            app.refresh_from_db()
            if final != "applied":
                app.viewed_at = start + timedelta(hours=5)
                app.save(update_fields=["viewed_at"])
                ApplicationRating.objects.get_or_create(application=app, author=recruiter, defaults={"stars": rnd.randint(3, 5)})
            if idx in (0, 2):
                app.tags = ["strong DSA", "campus pick"]
                app.save(update_fields=["tags"])
                ApplicationNote.objects.create(application=app, author=recruiter, body="Great system design answers. Good culture fit.")
            if final in ("interview", "offered", "selected"):
                when = now + timedelta(days=2, hours=idx) if final == "interview" else start + timedelta(days=6)
                iv = Interview.objects.create(
                    application=app, round_name="Technical interview", scheduled_at=when, duration_minutes=45, mode="video",
                    meeting_link="https://meet.google.com/demo-link", created_by=recruiter,
                    status="scheduled" if final == "interview" else "completed",
                    candidate_response="pending" if final == "interview" else "confirmed",
                )
                iv.interviewers.set([interviewer])
                if final != "interview":
                    InterviewFeedback.objects.create(interview=iv, author=interviewer, technical=5, communication=4, culture=4, recommendation="yes",
                                                     comments="Clear thinking, clean code.")
            if final in ("offered", "selected"):
                Offer.objects.create(
                    application=app, role_title=internship.title, stipend=internship.stipend,
                    start_date=timezone.localdate() + timedelta(days=45), duration_months=6, location=internship.location,
                    expires_on=timezone.localdate() + timedelta(days=7), sent_by=recruiter,
                    status="accepted" if final == "selected" else "pending",
                    responded_at=now if final == "selected" else None,
                )

        # campus: a drive with registrations, and two announcements
        drive, created = PlacementDrive.objects.get_or_create(
            university=uni, title="Nova Tech on-campus hiring day",
            defaults={
                "company": company, "internship": listings[2], "drive_date": now + timedelta(days=6), "venue": "Auditorium, Block 34",
                "registration_deadline": timezone.localdate() + timedelta(days=4), "min_cgpa": "7.0", "allowed_branches": "CSE, IT, ECE",
                "description": "Aptitude test at 10 am, interviews from 2 pm. Bring two copies of your resume.", "created_by": tpo,
            },
        )
        if created:
            for p in profiles[6:9]:
                DriveRegistration.objects.get_or_create(drive=drive, student=p)
            Announcement.objects.create(university=uni, author=tpo, title="Resume review clinic — Friday 3 pm", pinned=True,
                                        body="Bring a printed resume. Seniors from the placement committee will review it one to one.")
            Announcement.objects.create(university=uni, author=tpo, title="Verify your profile",
                                        body="Add your enrollment number and CGPA so we can verify you. Recruiters see verified students first.")

        self.stdout.write(self.style.SUCCESS(
            f"Demo data ready. Sign in with password {PASSWORD}:\n"
            "  demo_recruiter (company admin) · demo_interviewer · demo_tpo (placement cell) · demo_student1 … demo_student12"
        ))
