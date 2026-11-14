"""A full, lived-in CareerBridge: real universities, many companies, students with real histories.

    python manage.py seed_world                 # build it (adds to what's there; run --reset to start over)
    python manage.py seed_world --reset         # remove everything this command made, then build it again
    python manage.py seed_world --students 240  # how many students (default 180)

Every account it makes signs in with the password  Careers@2026  and has an email ending in @careerbridge.test
(a reserved domain: nothing can ever be delivered there, so no real inbox gets notification emails). The full list
of accounts, with the story behind the interesting ones, is written to seed_accounts.md (see --out).

What's in it:
  - 8 real universities from the catalogue, each with a placement officer and a coordinator, drives, announcements
  - 16 companies (fictional) with an admin, recruiters and an interviewer; 2 are waiting to be verified
  - ~50 internships (live, closed, draft) with skills, eligibility and screening questions
  - students with skills, experience, certifications and achievements, and ~4 applications each, every one walked
    through the real pipeline with its history, ratings, notes, interviews, scorecards and offers
  - stories to follow end to end: rejected five times then hired, two offers, an offer waiting, an interview
    tomorrow, hired through a campus drive, verification sent back, a brand-new student with nothing yet
"""

import random
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from accounts.models import User
from applications import services
from applications.models import Application, ApplicationEvent, ApplicationNote, ApplicationRating, Interview, InterviewFeedback, Offer
from campus.models import Announcement, DriveRegistration, PlacementDrive
from institutions.models import Achievement, Certification, Company, CompanyMembership, Experience, StudentProfile, University, UniversityStaff
from internships.models import Internship, InternshipSkill, ScreeningQuestion, Skill, StudentSkill
from notifications.service import notify

PASSWORD = "Careers@2026"
DOMAIN = "careerbridge.test"

UNIVERSITIES = [  # (name in the catalogue, short, city, enrollment prefix)
    ("Lovely Professional University", "lpu", "Phagwara, Punjab", "1221"),
    ("Vellore Institute of Technology", "vit", "Vellore, Tamil Nadu", "21BCE"),
    ("SRM Institute Of Science & Technology", "srm", "Chennai, Tamil Nadu", "RA21"),
    ("Manipal University", "manipal", "Manipal, Karnataka", "2101"),
    ("Chitkara University", "chitkara", "Rajpura, Punjab", "2110"),
    ("Thapar Institute of Engineering and Technology", "thapar", "Patiala, Punjab", "1021"),
    ("Christ University", "christ", "Bengaluru, Karnataka", "2134"),
    ("Kalinga Institute of Industrial Technology (KIIT)", "kiit", "Bhubaneswar, Odisha", "2105"),
]

# (name, industry, size, city, founded, verified, about)
COMPANIES = [
    ("Nimbus Analytics", "Data & Analytics", "medium", "Bengaluru", 2014, True, "Dashboards and forecasting for retail and logistics teams."),
    ("Kestrel Pay", "Fintech", "large", "Mumbai", 2011, True, "Payments infrastructure used by 40,000 Indian merchants."),
    ("Orbitlane Software", "SaaS", "small", "Pune", 2018, True, "Project-planning software for construction firms."),
    ("Greenleaf Health", "Healthtech", "medium", "Hyderabad", 2016, True, "Clinic management and telemedicine for tier-2 cities."),
    ("Bytecraft Labs", "Developer tools", "startup", "Bengaluru", 2021, True, "Testing tools that catch flaky tests before they ship."),
    ("Saffron Retail Tech", "E-commerce", "large", "Gurugram", 2012, True, "The software behind 300 grocery and fashion stores."),
    ("Monsoon Mobility", "Mobility", "medium", "Chennai", 2017, True, "EV fleet tracking and charging for delivery companies."),
    ("Quillstone Media", "Media", "small", "Mumbai", 2015, True, "Regional-language news and video, read by 8 million a month."),
    ("Helix BioInformatics", "Biotech", "small", "Hyderabad", 2019, True, "Genome-analysis pipelines for research hospitals."),
    ("Tidewater Logistics", "Logistics", "large", "Kolkata", 2009, True, "Freight and warehousing across eastern India."),
    ("Parallax Games", "Gaming", "startup", "Pune", 2020, True, "Mobile puzzle games with 12 million downloads."),
    ("Ironwood Systems", "Enterprise software", "large", "Noida", 2008, True, "ERP and HR systems for manufacturing companies."),
    ("Lumen EdTech", "EdTech", "medium", "Bengaluru", 2016, True, "Live coding classes for school students."),
    ("Cobalt Cloud", "Cloud infrastructure", "medium", "Hyderabad", 2015, True, "Managed Kubernetes and databases for Indian startups."),
    ("Marigold Design Studio", "Design", "startup", "Ahmedabad", 2022, False, "Brand and product design for D2C brands."),
    ("Vantage AI Works", "AI", "startup", "Bengaluru", 2023, False, "Document AI for insurance claims."),
]

# role templates: (title, skills (first three required), stipend, months, min CGPA, branches)
ROLES = [
    ("Backend Engineer Intern", ["Python", "Django", "PostgreSQL", "Docker", "REST APIs"], 25000, 6, "7.0", "CSE, IT"),
    ("Frontend Developer Intern", ["React", "TypeScript", "JavaScript", "Tailwind CSS", "Git"], 22000, 6, "6.5", "CSE, IT, ECE"),
    ("Full Stack Developer Intern", ["JavaScript", "Node.js", "React", "MongoDB", "Express"], 28000, 6, "7.0", "CSE, IT"),
    ("Data Analyst Intern", ["SQL", "Excel", "Python", "Power BI", "Statistics"], 18000, 3, "6.5", ""),
    ("Machine Learning Intern", ["Python", "Machine Learning", "PyTorch", "scikit-learn", "NumPy"], 35000, 6, "8.0", "CSE, IT, ECE"),
    ("Android Developer Intern", ["Kotlin", "Android", "Git", "REST APIs"], 24000, 6, "6.5", "CSE, IT, ECE"),
    ("DevOps Intern", ["Linux", "Docker", "Kubernetes", "CI/CD", "AWS"], 30000, 6, "7.0", "CSE, IT"),
    ("UI/UX Design Intern", ["Figma", "UI Design", "UX Research", "Prototyping", "Wireframing"], 20000, 3, "", ""),
    ("Product Analyst Intern", ["SQL", "Data Analysis", "Excel", "Communication", "Tableau"], 22000, 6, "7.0", ""),
    ("QA Automation Intern", ["Testing", "Python", "JavaScript", "Git"], 16000, 3, "6.0", "CSE, IT, ECE"),
    ("Cloud Engineer Intern", ["AWS", "Linux", "Terraform", "Docker"], 32000, 6, "7.5", "CSE, IT"),
    ("Data Science Intern", ["Python", "Pandas", "Statistics", "Machine Learning", "Data Visualization"], 30000, 6, "7.5", ""),
    ("iOS Developer Intern", ["Swift", "iOS", "Git"], 26000, 6, "7.0", "CSE, IT"),
    ("Content & SEO Intern", ["Content Writing", "SEO", "Digital Marketing", "Communication"], 12000, 3, "", ""),
    ("Game Developer Intern", ["C#", "C++", "Object-Oriented Programming", "Problem Solving"], 20000, 6, "6.5", "CSE, IT"),
    ("NLP Research Intern", ["Python", "NLP", "LLMs", "PyTorch", "Deep Learning"], 40000, 6, "8.5", "CSE, IT"),
]
# which roles each company hires for (indexes into ROLES)
HIRES = [
    [3, 11, 8], [0, 2, 9, 4], [1, 2, 7], [0, 3, 5], [9, 0, 6], [2, 1, 8, 13], [5, 12, 6], [13, 1, 7],
    [11, 4, 15], [3, 8, 0], [14, 5, 7], [0, 9, 6, 2], [1, 13, 3], [6, 10, 0], [7, 13], [15, 4],
]
CITIES = ["Bengaluru", "Pune", "Hyderabad", "Mumbai", "Chennai", "Gurugram", "Noida", "Remote"]

FIRST = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna", "Ishaan", "Shaurya", "Atharv", "Kabir", "Rohan", "Karthik", "Siddharth",
         "Nikhil", "Pranav", "Harsh", "Yash", "Dev", "Rahul", "Aman", "Varun", "Tanmay", "Om", "Rudra", "Ayaan", "Advik", "Manav", "Parth",
         "Ananya", "Diya", "Aadhya", "Saanvi", "Isha", "Myra", "Kiara", "Anika", "Riya", "Priya", "Sneha", "Meera", "Pooja", "Kavya", "Tanya",
         "Nandini", "Shreya", "Aditi", "Ira", "Navya", "Simran", "Neha", "Divya", "Ritika", "Sakshi", "Muskan", "Khushi", "Anjali", "Pallavi", "Zoya"]
LAST = ["Sharma", "Verma", "Gupta", "Singh", "Patel", "Reddy", "Nair", "Iyer", "Menon", "Rao", "Kulkarni", "Deshmukh", "Joshi", "Mehta", "Shah",
        "Chopra", "Kapoor", "Malhotra", "Bhatia", "Saxena", "Mishra", "Pandey", "Tiwari", "Chauhan", "Yadav", "Das", "Bose", "Mukherjee", "Banerjee",
        "Ghosh", "Pillai", "Naidu", "Hegde", "Shetty", "Kaur", "Gill", "Sandhu", "Dutta", "Agarwal", "Jain"]

BRANCHES = [  # (branch, degree, skill pool)
    ("CSE", "B.Tech", ["Python", "Java", "C++", "Data Structures", "Algorithms", "React", "JavaScript", "SQL", "Django", "Node.js", "Git", "Machine Learning", "Docker", "TypeScript", "System Design"]),
    ("IT", "B.Tech", ["Python", "JavaScript", "React", "SQL", "Node.js", "MongoDB", "Git", "Linux", "AWS", "Express", "HTML", "CSS", "Testing"]),
    ("ECE", "B.Tech", ["C++", "Python", "MATLAB", "Embedded", "Linux", "Data Analysis", "Machine Learning", "Problem Solving"]),
    ("AI & DS", "B.Tech", ["Python", "Machine Learning", "Deep Learning", "PyTorch", "Pandas", "NumPy", "Statistics", "SQL", "NLP", "Data Visualization", "scikit-learn"]),
    ("BCA", "BCA", ["Java", "PHP", "MySQL", "HTML", "CSS", "JavaScript", "Python", "Git"]),
    ("MCA", "MCA", ["Java", "Python", "React", "SQL", "Spring", "REST APIs", "Git", "Docker"]),
    ("Mechanical", "B.Tech", ["MATLAB", "Excel", "Python", "Project Management", "Problem Solving"]),
    ("B.Des", "B.Des", ["Figma", "UI Design", "UX Research", "Prototyping", "Adobe Photoshop", "Adobe Illustrator", "Wireframing"]),
    ("BBA", "BBA", ["Excel", "Communication", "Digital Marketing", "Content Writing", "Data Analysis", "Public Speaking"]),
]
BRANCH_WEIGHTS = [30, 18, 10, 12, 8, 6, 5, 6, 5]

CERTS = [("AWS Certified Cloud Practitioner", "Amazon Web Services"), ("Google Data Analytics Certificate", "Google / Coursera"), ("Meta Front-End Developer", "Meta / Coursera"),
         ("Machine Learning Specialization", "DeepLearning.AI"), ("Azure Fundamentals (AZ-900)", "Microsoft"), ("Python for Everybody", "University of Michigan / Coursera"),
         ("Google UX Design Certificate", "Google / Coursera"), ("Oracle Java SE Programmer", "Oracle"), ("CCNA", "Cisco"), ("Postman API Fundamentals", "Postman")]
ACHIEVEMENTS = ["Smart India Hackathon finalist", "Top 5% in Codeforces Div. 2 rounds", "Winner, college hackathon (48 hours)", "Published a paper at an IEEE student conference",
                "Google Summer of Code contributor", "Runner-up, inter-college design sprint", "Led the coding club's workshop series", "Kaggle notebook bronze medal"]
INTERNSHIP_PLACES = ["Infosys", "TCS", "a local startup", "the college's research lab", "a family business", "Wipro", "a digital agency", "an NGO"]

REJECT_NOTES = ["Skills don't match the stack yet.", "Strong profile, but we filled the role.", "Needs more depth in fundamentals.", "Good attitude; revisit next cycle.",
                "Couldn't commit to the full 6 months.", "Communication was great, coding round was weak."]
GOOD_NOTES = ["Great problem solving in the coding round.", "Clear communicator, asks good questions.", "Built a solid side project with this stack.",
              "Strong fundamentals, would grow fast here.", "Excellent portfolio."]


def mail(username):
    return f"{username}@{DOMAIN}"


class Command(BaseCommand):
    help = "Fill CareerBridge with realistic universities, companies, students and application histories."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Remove everything this command made first.")
        parser.add_argument("--students", type=int, default=180)
        parser.add_argument("--out", default=str(Path(settings.BASE_DIR) / "seed_accounts.md"), help="Where to write the account list.")

    def handle(self, *args, reset=False, students=180, out="", **opts):
        if reset:
            self.reset()
        with transaction.atomic():
            accounts = self.build(students)
        Path(out).write_text(self.sheet(accounts), encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"Done. Every account signs in with {PASSWORD}. The full list is in {out}"))

    # ── reset ────────────────────────────────────────────────────────────────
    def reset(self):
        with transaction.atomic():
            Company.objects.filter(name__in=[c[0] for c in COMPANIES]).delete()
            users = User.objects.filter(email__endswith="@" + DOMAIN)
            n = users.count()
            PlacementDrive.objects.filter(created_by__in=users).delete()
            Announcement.objects.filter(author__in=users).delete()
            users.delete()
        self.stdout.write(f"Removed {n} seeded accounts and everything they owned.")

    # ── build ────────────────────────────────────────────────────────────────
    def user(self, username, role, first, last, joined):
        base, n = username, 1
        while User.objects.filter(username=username).exists():
            n += 1
            username = f"{base}{n}"
        u = User(username=username, role=role, first_name=first, last_name=last, email=mail(username), phone=f"9{self.rnd.randint(100000000, 999999999)}",
                 gender=self.rnd.choice(["male", "female"]) if role == "student" else "")
        u.set_password(PASSWORD)
        u.save()
        User.objects.filter(pk=u.pk).update(date_joined=joined)
        return u

    def build(self, n_students):
        rnd = self.rnd = random.Random(2026)
        if not Skill.objects.exists():
            call_command("seed_skills")
        self.skill = {s.name: s for s in Skill.objects.all()}
        now = self.now = timezone.now()
        today = timezone.localdate()
        acc = {"universities": [], "companies": [], "students": [], "stories": []}

        # universities, their placement cells, announcements
        unis = []
        for name, short, city, prefix in UNIVERSITIES:
            uni = University.objects.filter(name=name).first() or University.objects.create(name=name, location=city)
            if not uni.location:
                uni.location = city
                uni.save(update_fields=["location"])
            tpo_f, tpo_l = rnd.choice(FIRST[30:]), rnd.choice(LAST)
            tpo = self.user(f"tpo.{short}", "university", tpo_f, tpo_l, now - timedelta(days=200))
            UniversityStaff.objects.create(user=tpo, university=uni, is_admin=True, admin_rank=0, title="Training & Placement Officer")
            co_f, co_l = rnd.choice(FIRST[:30]), rnd.choice(LAST)
            coord = self.user(f"placements.{short}", "university", co_f, co_l, now - timedelta(days=150))
            UniversityStaff.objects.create(user=coord, university=uni, is_admin=False, title="Placement Coordinator")
            for title, body, pinned, ago in [
                ("Placement season 2026: what to expect", "Drives run from August to March. Keep your profile verified and your resume current; we shortlist from CareerBridge.", True, 90),
                ("Resume review clinic, every Friday 3 pm", "Bring a printed resume to the placement cell. Seniors who were placed last year review it with you, one to one.", False, 40),
                ("Mock interviews next week", "Sign up at the placement cell desk. Technical and HR rounds, 30 minutes each, with written feedback.", False, 12),
            ]:
                a = Announcement.objects.create(university=uni, author=tpo, title=title, body=body, pinned=pinned)
                Announcement.objects.filter(pk=a.pk).update(created_at=now - timedelta(days=ago))
            unis.append({"uni": uni, "short": short, "prefix": prefix, "tpo": tpo, "coord": coord, "students": []})
            acc["universities"].append((uni.name, [(tpo.username, "Training & Placement Officer (placement-cell admin)"), (coord.username, "Placement coordinator")]))

        # companies, their teams and openings
        comps = []
        for ci, (name, industry, size, city, founded, verified, about) in enumerate(COMPANIES):
            slug = slugify(name).split("-")[0]
            c = Company.objects.create(
                name=name, industry=industry, size=size, location=city, founded_year=founded, is_verified=verified,
                website=f"https://{slugify(name)}.example", linkedin_url=f"https://linkedin.com/company/{slugify(name)}",
                description=f"{about} We hire interns every season and most of them get return offers.",
                culture=rnd.choice(["Small teams, real ownership, and a mentor for every intern.", "Weekly demo days, honest code reviews, and no busywork.",
                                     "Hybrid by default, with team offsites every quarter.", "You ship to production in your first two weeks."]),
            )
            Company.objects.filter(pk=c.pk).update(created_at=now - timedelta(days=rnd.randint(120, 400)))
            people = []
            for role, label, k in [("admin", "Company admin (head of hiring)", 0), ("recruiter", "Recruiter", 1), ("recruiter", "Recruiter", 2), ("interviewer", "Interviewer (engineer)", 3)]:
                if k == 2 and size in ("startup", "small"):
                    continue
                f, l = rnd.choice(FIRST), rnd.choice(LAST)
                u = self.user(f"{f.lower()}.{slug}", "company", f, l, now - timedelta(days=rnd.randint(100, 300)))
                CompanyMembership.objects.create(user=u, company=c, role=role)
                people.append((u, role, label))
            admin_u = people[0][0]
            recruiters = [p[0] for p in people if p[1] in ("admin", "recruiter")]
            interviewers = [p[0] for p in people if p[1] == "interviewer"] or [admin_u]
            jobs = []
            for ri in HIRES[ci]:
                title, skills, stipend, months, min_cgpa, branches = ROLES[ri]
                status = rnd.choices(["published", "closed", "draft"], [70, 22, 8])[0]
                posted = now - timedelta(days=rnd.randint(15, 110))
                where = rnd.choice([city, city, "Remote", rnd.choice(CITIES)])
                job = Internship.objects.create(
                    company=c, posted_by=rnd.choice(recruiters), title=title, location=where,
                    work_mode="remote" if where == "Remote" else rnd.choice(["onsite", "hybrid", "hybrid"]),
                    stipend=Decimal(stipend + rnd.choice([-4000, -2000, 0, 0, 3000, 5000])), duration_months=months, openings=rnd.randint(1, 5),
                    deadline=(today + timedelta(days=rnd.randint(7, 45))) if status == "published" else (today - timedelta(days=rnd.randint(5, 40))),
                    status=status, min_cgpa=Decimal(min_cgpa) if min_cgpa else None, allowed_branches=branches,
                    description=(
                        f"{name} is looking for a {title.lower()} to join for {months} months.\n\n"
                        f"What you'll do\n- Work with a senior {title.split()[0].lower()} on features that ship to real users\n"
                        "- Take part in code or design reviews every week\n- Present what you built at the end of the internship\n\n"
                        f"What we're looking for\n- Comfortable with {', '.join(skills[:3])}\n- Curious, and happy to ask questions\n\n"
                        f"Perks\n- Stipend of ₹{stipend:,} a month\n- Certificate and a letter of recommendation\n- Return offer for strong performers"
                    ),
                )
                Internship.objects.filter(pk=job.pk).update(created_at=posted)
                job.created_at = posted
                for k, sname in enumerate(skills):
                    if sname in self.skill:
                        InternshipSkill.objects.create(internship=job, skill=self.skill[sname], is_required=k < 3)
                ScreeningQuestion.objects.create(internship=job, text=f"Can you work for {months} months starting next month?", kind="yesno", knockout_answer="Yes")
                jobs.append(job)
            comps.append({"c": c, "admin": admin_u, "recruiters": recruiters, "interviewers": interviewers, "jobs": jobs})
            acc["companies"].append((c.name, verified, [(u.username, label) for u, _, label in people], [j.title + ("" if j.status == "published" else f" ({j.status})") for j in jobs]))

        all_jobs = [j for c in comps for j in c["jobs"]]
        live_jobs = [j for j in all_jobs if j.status == "published"]
        job_company = {j.id: c for c in comps for j in c["jobs"]}

        # students
        used = set()
        profiles = []
        for i in range(n_students):
            u_info = unis[i % len(unis)]
            first, last = rnd.choice(FIRST), rnd.choice(LAST)
            while (first, last) in used:
                first, last = rnd.choice(FIRST), rnd.choice(LAST)
            used.add((first, last))
            bi = rnd.choices(range(len(BRANCHES)), BRANCH_WEIGHTS)[0]
            branch, degree, pool = BRANCHES[bi]
            year = rnd.choices([2026, 2027, 2028], [35, 45, 20])[0]
            cgpa = round(min(9.8, max(5.6, rnd.gauss(7.8, 0.85))), 2)
            joined = now - timedelta(days=rnd.randint(20, 240))
            u = self.user(f"{first.lower()}.{last.lower()}", "student", first, last, joined)
            verification = rnd.choices(["verified", "unverified", "rejected"], [62, 32, 6])[0]
            p = StudentProfile.objects.create(
                user=u, university=u_info["uni"], degree=degree, branch=branch, graduation_year=year, cgpa=Decimal(str(cgpa)),
                enrollment_number=f"{u_info['prefix']}{rnd.randint(1000, 9999)}", verification_status=verification,
                verified_at=(joined + timedelta(days=rnd.randint(3, 20))) if verification == "verified" else None,
                verified_by=u_info["tpo"] if verification != "unverified" else None,
                verification_note="The CGPA on your profile doesn't match our records. Please update it." if verification == "rejected" else "",
                linkedin_url=f"https://linkedin.com/in/{first.lower()}-{last.lower()}-{rnd.randint(10, 99)}" if rnd.random() < 0.8 else "",
                github_url=f"https://github.com/{first.lower()}{last.lower()[:3]}{rnd.randint(1, 99)}" if branch not in ("BBA", "B.Des") and rnd.random() < 0.7 else "",
                resume_url=f"https://drive.example/resume/{first.lower()}-{last.lower()}.pdf" if rnd.random() < 0.85 else "",
                bio=rnd.choice([f"{branch} student who likes building things people actually use.", f"Final-year {branch} student looking for a {rnd.choice(['backend', 'frontend', 'data', 'product', 'design'])} internship.",
                                f"{degree} {branch}, {year}. I learn fastest by shipping small projects.", f"Curious about {rnd.choice(pool)} and {rnd.choice(pool)}; open to remote roles."]),
                is_available=rnd.random() < 0.9,
            )
            for sname in rnd.sample(pool, k=min(len(pool), rnd.randint(3, 7))):
                if sname in self.skill:
                    StudentSkill.objects.create(student=p, skill=self.skill[sname], proficiency=rnd.choices(["beginner", "intermediate", "advanced"], [25, 50, 25])[0])
            if rnd.random() < 0.55:
                start = today - timedelta(days=rnd.randint(120, 500))
                Experience.objects.create(profile=p, title=rnd.choice(["Software Intern", "Web Development Intern", "Data Intern", "Summer Trainee", "Design Intern"]),
                                          company=rnd.choice(INTERNSHIP_PLACES), location=rnd.choice(CITIES), start_date=start, end_date=start + timedelta(days=rnd.choice([45, 60, 90])),
                                          description="Built and shipped small features with the team; wrote tests and documentation.")
            if rnd.random() < 0.5:
                cname, issuer = rnd.choice(CERTS)
                Certification.objects.create(profile=p, name=cname, issuer=issuer, issued_on=today - timedelta(days=rnd.randint(30, 400)), credential_id=f"CB-{rnd.randint(100000, 999999)}")
            if rnd.random() < 0.35:
                Achievement.objects.create(profile=p, title=rnd.choice(ACHIEVEMENTS), achieved_on=today - timedelta(days=rnd.randint(30, 600)))
            profiles.append(p)
            u_info["students"].append(p)

        # ── applications ─────────────────────────────────────────────────────
        def walk(p, job, final, *, start=None, source="direct", offer_status=None, interview_when=None, response="confirmed", note=None):
            """Apply, then move it stage by stage to `final`, with the history, ratings, interviews and offer it would have."""
            c = job_company[job.id]
            rec = rnd.choice(c["recruiters"])
            start = start or max(job.created_at + timedelta(days=1), now - timedelta(days=rnd.randint(4, 80)))
            app = Application.objects.create(student=p, internship=job, source=source, cover_letter=rnd.choice([
                f"I've been building with {rnd.choice(['Python', 'React', 'SQL', 'Figma'])} for two years and would love to learn from your team.",
                "I'm excited about what you're building and I'd like to contribute from day one.", "",
                f"Your work in {c['c'].industry.lower()} is exactly what I want to learn. My projects are on my profile."]),
                answers=[{"question_id": job.screening_questions.first().id, "question": job.screening_questions.first().text, "answer": "Yes"}])
            Application.objects.filter(pk=app.pk).update(applied_at=start)
            services.log(app, "applied", p.user, to_status="applied")
            app.events.filter(kind="applied").update(created_at=start)
            path = {"applied": [], "review": ["review"], "shortlisted": ["review", "shortlisted"], "interview": ["review", "shortlisted", "interview"],
                    "offered": ["review", "shortlisted", "interview", "offered"], "selected": ["review", "shortlisted", "interview", "offered", "selected"]}
            if final.startswith("rejected"):
                at = final.split("@")[1] if "@" in final else rnd.choice(["applied", "review", "shortlisted", "interview"])
                stages = path[at] + ["rejected"]
            else:
                stages = path[final]
            t = start
            if stages:
                t += timedelta(hours=rnd.randint(3, 30))
                services.log(app, "viewed", rec)
                app.events.filter(kind="viewed").update(created_at=t)
                Application.objects.filter(pk=app.pk).update(viewed_at=t)
            for st in stages:
                t += timedelta(days=rnd.randint(1, 5), hours=rnd.randint(0, 8))
                if t > now:
                    t = now - timedelta(hours=rnd.randint(1, 20))
                services.move(app, st, rec, notify_student=False, detail=rnd.choice(REJECT_NOTES) if st == "rejected" else "")
                app.events.filter(kind="moved", to_status=st).update(created_at=t)
                Application.objects.filter(pk=app.pk).update(status_changed_at=t)
            app.refresh_from_db()
            if stages:
                good = app.status in ("shortlisted", "interview", "offered", "selected")
                ApplicationRating.objects.create(application=app, author=rec, stars=rnd.randint(4, 5) if good else rnd.randint(1, 3))
                if good and rnd.random() < 0.6:
                    ApplicationNote.objects.create(application=app, author=rec, body=note or rnd.choice(GOOD_NOTES))
                    app.tags = rnd.sample(["strong DSA", "good portfolio", "relocate OK", "campus pick", "fast learner", "return offer?"], k=2)
                    app.save(update_fields=["tags"])
            # interviews
            if "interview" in stages:
                done = app.status != "interview"
                when = interview_when or ((now + timedelta(days=rnd.randint(1, 6), hours=rnd.randint(10, 17) - now.hour)) if not done else t - timedelta(days=rnd.randint(1, 3)))
                iv = Interview.objects.create(
                    application=app, round_name=rnd.choice(["Technical interview", "Coding round", "Design review", "Hiring manager chat"]), scheduled_at=when,
                    duration_minutes=rnd.choice([30, 45, 60]), mode=rnd.choice(["video", "video", "phone", "onsite"]), meeting_link="https://meet.google.com/abc-defg-hij",
                    created_by=rec, status="completed" if done else "scheduled", candidate_response="confirmed" if done else response,
                    candidate_note="I have an exam that morning; could we do the afternoon?" if response == "reschedule" else "",
                    instructions="Keep a laptop ready with your editor. We'll pair on a small problem.",
                )
                iv.interviewers.set(c["interviewers"])
                services.log(app, "interview", rec, detail=f"{iv.round_name} scheduled")
                if done:
                    hired = app.status in ("offered", "selected")
                    InterviewFeedback.objects.create(interview=iv, author=c["interviewers"][0], technical=rnd.randint(4, 5) if hired else rnd.randint(2, 3),
                                                     communication=rnd.randint(3, 5), culture=rnd.randint(3, 5),
                                                     recommendation=rnd.choice(["strong_yes", "yes"]) if hired else rnd.choice(["no", "strong_no", "no"]),
                                                     comments=rnd.choice(GOOD_NOTES) if hired else rnd.choice(REJECT_NOTES))
            # offers
            if app.status in ("offered", "selected"):
                status = offer_status or ("accepted" if app.status == "selected" else "pending")
                sent = t - timedelta(days=1 if app.status == "selected" else 0)
                o = Offer.objects.create(
                    application=app, role_title=job.title, stipend=job.stipend, start_date=today + timedelta(days=rnd.randint(20, 60)), duration_months=job.duration_months,
                    location=job.location, expires_on=today + timedelta(days=rnd.randint(2, 9)) if status == "pending" else today - timedelta(days=2),
                    message=f"We loved meeting you, {p.user.first_name}. We'd be glad to have you with us at {c['c'].name}.", sent_by=rec, status=status,
                    responded_at=t if status in ("accepted", "declined") else None,
                    response_note={"accepted": "Thank you! Excited to start.", "declined": "Thank you so much, I've accepted another offer that's closer to home."}.get(status, ""),
                )
                Offer.objects.filter(pk=o.pk).update(created_at=sent)
                services.log(app, "offer", rec, detail=f"Offer {status}")
            return app

        taken = set()

        def apply(p, job, final, **kw):
            if (p.id, job.id) in taken:
                return None
            taken.add((p.id, job.id))
            return walk(p, job, final, **kw)

        # the stories (the first students), each easy to follow end to end
        S = profiles
        story_jobs = sorted(live_jobs, key=lambda j: j.id)
        # 1. rejected five times, at every stage, then hired
        hero = S[0]
        for k, at in enumerate(["applied", "review", "shortlisted", "interview", "interview"]):
            apply(hero, story_jobs[k], f"rejected@{at}", start=now - timedelta(days=110 - k * 15))
        apply(hero, story_jobs[5], "selected", start=now - timedelta(days=25))
        acc["stories"].append((hero.user.username, "Rejected by five companies (at every stage, two after interviews), then hired by the sixth. Their applications page tells the whole story."))
        # 2. two offers: accepted one, declined the other
        two = S[1]
        apply(two, story_jobs[6], "selected", start=now - timedelta(days=40))
        apply(two, story_jobs[7], "offered", start=now - timedelta(days=38), offer_status="declined")
        apply(two, story_jobs[8], "rejected@review", start=now - timedelta(days=50))
        acc["stories"].append((two.user.username, "Got two offers: accepted one, declined the other (with a note). Also one early rejection."))
        # 3. an offer waiting for a reply
        wait = S[2]
        apply(wait, story_jobs[9], "offered", start=now - timedelta(days=20))
        apply(wait, story_jobs[10], "interview", start=now - timedelta(days=12))
        acc["stories"].append((wait.user.username, "Has an offer waiting for their reply (expires within the week) and another interview coming up."))
        # 4. interview tomorrow; 5. asked to reschedule
        tomorrow = (now + timedelta(days=1)).replace(hour=11, minute=0, second=0, microsecond=0)
        apply(S[3], story_jobs[11], "interview", start=now - timedelta(days=9), interview_when=tomorrow)
        apply(S[3], story_jobs[12], "shortlisted", start=now - timedelta(days=6))
        acc["stories"].append((S[3].user.username, "Interview tomorrow at 11:00 (confirmed), plus a shortlist elsewhere."))
        apply(S[4], story_jobs[13], "interview", start=now - timedelta(days=8), response="reschedule")
        acc["stories"].append((S[4].user.username, "Asked the recruiter to reschedule their interview (with a reason). The recruiter sees the request."))
        # 6. brand new: nothing yet
        StudentProfile.objects.filter(pk=S[5].pk).update(linkedin_url="", github_url="", resume_url="", bio="", verification_status="unverified", verified_at=None, verified_by=None)
        StudentSkill.objects.filter(student=S[5]).delete()
        acc["stories"].append((S[5].user.username, "Brand-new student: empty profile, no skills, no applications. Good for testing onboarding."))
        # 7. verification sent back
        StudentProfile.objects.filter(pk=S[6].pk).update(verification_status="rejected", verification_note="Your enrollment number doesn't match our records. Please check and update it.")
        apply(S[6], story_jobs[14], "review")
        acc["stories"].append((S[6].user.username, "Their university sent verification back with a note to fix the enrollment number."))
        # 8. many applications, all still waiting
        for k in range(15, 22):
            apply(S[7], story_jobs[k % len(story_jobs)], "applied", start=now - timedelta(days=k - 13))
        acc["stories"].append((S[7].user.username, "Applied to seven roles this week; nobody has looked yet."))

        # everyone else: ~4 applications each, to roles that fit their branch, with a realistic spread of outcomes
        outcomes = ["applied", "review", "shortlisted", "interview", "offered", "selected", "rejected"]
        weights = [22, 16, 10, 8, 4, 6, 34]
        for p in S[8:]:
            branch = p.branch
            fitting = [j for j in all_jobs if j.status != "draft" and (not j.allowed_branches or branch in j.allowed_branches)] or live_jobs
            for job in rnd.sample(fitting, k=min(len(fitting), rnd.choices([0, 1, 2, 3, 4, 5, 6, 8], [6, 10, 16, 20, 20, 14, 9, 5])[0])):
                final = rnd.choices(outcomes, weights)[0]
                if job.status == "closed" and final in ("applied", "review"):
                    final = "rejected"
                apply(p, job, final)

        # a recruiter with a big pipeline: one role with applicants at every stage
        big = comps[1]["jobs"][0]
        for p in rnd.sample(S[8:], k=min(40, len(S) - 8)):
            apply(p, big, rnd.choices(outcomes, [30, 20, 12, 10, 3, 3, 22])[0])
        acc["stories"].append((comps[1]["admin"].username, f"Head of hiring at {comps[1]['c'].name}: '{big.title}' has a full pipeline with applicants at every stage, ratings, notes and scorecards."))

        # campus drives: completed, ongoing, upcoming; with registrations and outcomes
        for u_info in unis:
            uni, tpo = u_info["uni"], u_info["tpo"]
            pool = u_info["students"]
            for k, (state, days) in enumerate([("completed", -35), ("upcoming", 9), ("upcoming", 24)]):
                c = comps[(UNIVERSITIES.index(next(x for x in UNIVERSITIES if x[0] == uni.name)) * 2 + k) % len(comps)]
                job = next((j for j in c["jobs"] if j.status == "published"), c["jobs"][0])
                d = PlacementDrive.objects.create(
                    university=uni, company=c["c"], internship=job, title=f"{c['c'].name} campus hiring: {job.title}", drive_date=now + timedelta(days=days),
                    venue=rnd.choice(["Main auditorium", "Seminar hall, Block 34", "Placement cell, 3rd floor", "Online (link sent to registered students)"]),
                    registration_deadline=today + timedelta(days=days - 3), min_cgpa=job.min_cgpa, allowed_branches=job.allowed_branches, graduation_year=2027 if k else None,
                    description="Aptitude test in the morning, technical interviews in the afternoon. Carry your college ID and two copies of your resume.",
                    status=state, created_by=tpo,
                )
                regs = rnd.sample(pool, k=min(len(pool), rnd.randint(6, 14)))
                for p in regs:
                    outcome = "pending" if state != "completed" else rnd.choices(["selected", "not_selected"], [25, 75])[0]
                    DriveRegistration.objects.create(drive=d, student=p, attended=state == "completed" and rnd.random() < 0.9, outcome=outcome)
                    if outcome == "selected":
                        apply(p, job, "selected", source="drive", start=now - timedelta(days=36))
        placed_by_drive = DriveRegistration.objects.filter(outcome="selected", student__user__email__endswith="@" + DOMAIN).select_related("student__user").first()
        if placed_by_drive:
            acc["stories"].append((placed_by_drive.student.user.username, "Hired through a campus placement drive at their university (source: Campus drive)."))

        # a few notifications so bells aren't empty (no email: these domains can't receive mail anyway)
        for p in S[:8]:
            notify(p.user, "system", "Welcome to CareerBridge", "Complete your profile to see match scores on every listing.", "/dashboard/student/profile")
        for c in comps:
            if not c["c"].is_verified:
                notify([c["admin"]], "verification", f"{c['c'].name} is waiting for verification", "An admin will check your company details shortly.", "/dashboard/company/profile")

        # the sheet
        for u_info in unis:
            for p in u_info["students"]:
                apps = list(p.applications.values_list("status", flat=True))
                acc["students"].append((p.user.username, p.user.get_full_name(), u_info["uni"].name, f"{p.degree} {p.branch}", str(p.cgpa), p.verification_status,
                                        len(apps), sum(s == "selected" for s in apps)))
        self.totals = {
            "students": len(profiles), "companies": len(comps), "internships": len(all_jobs), "live": len(live_jobs),
            "applications": Application.objects.filter(student__in=profiles).count(), "hired": Application.objects.filter(student__in=profiles, status="selected").count(),
            "interviews": Interview.objects.filter(application__student__in=profiles).count(), "offers": Offer.objects.filter(application__student__in=profiles).count(),
            "drives": PlacementDrive.objects.filter(created_by__email__endswith="@" + DOMAIN).count(),
        }
        return acc

    # ── the account list ─────────────────────────────────────────────────────
    def sheet(self, acc):
        t = self.totals
        L = [
            "# CareerBridge seed accounts",
            "",
            f"Made by `python manage.py seed_world`. **Every account's password is `{PASSWORD}`.** Sign in with the username.",
            f"Emails end in `@{DOMAIN}`, a reserved domain that can never receive mail.",
            "",
            f"{t['students']} students · {t['companies']} companies · {t['internships']} internships ({t['live']} live) · {t['applications']} applications · "
            f"{t['interviews']} interviews · {t['offers']} offers · {t['hired']} hired · {t['drives']} campus drives",
            "",
            "## Stories to follow",
            "",
            "| Username | What to look at |",
            "|---|---|",
            *[f"| `{u}` | {s} |" for u, s in acc["stories"]],
            "",
            "## Universities (placement cells)",
            "",
        ]
        for name, staff in acc["universities"]:
            L.append(f"**{name}**: " + " · ".join(f"`{u}` ({r})" for u, r in staff))
            L.append("")
        L += ["## Companies", ""]
        for name, verified, people, jobs in acc["companies"]:
            L.append(f"**{name}**{'' if verified else ' (waiting to be verified)'}")
            L.append("- Team: " + " · ".join(f"`{u}` ({r})" for u, r in people))
            L.append("- Openings: " + "; ".join(jobs))
            L.append("")
        L += ["## Students", "", "| Username | Name | University | Course | CGPA | Verification | Applications | Hired |", "|---|---|---|---|---|---|---|---|"]
        L += [f"| `{u}` | {n} | {uni} | {course} | {cg} | {v} | {a} | {h} |" for u, n, uni, course, cg, v, a, h in acc["students"]]
        return "\n".join(L) + "\n"
