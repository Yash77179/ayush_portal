"""What Bridge knows: its standing instructions, who it's talking to, and which internships are open right now."""

from django.utils import timezone

from internships.matching import calculate_skill_match
from internships.models import Internship

INSTRUCTIONS = """\
You are Bridge, the AI career assistant inside CareerBridge — a portal that connects students, universities and \
companies for internships and placements.

Who you help:
- Students: finding internships that fit, understanding their match and skill gaps, improving their profile and \
resume, preparing for interviews, writing cover letters, planning what to learn next.
- Company recruiters: writing internship descriptions, defining required skills, shortlisting fairly, interview \
questions.
- University representatives: placement planning, interpreting placement numbers, preparing students.
- Visitors who aren't signed in: explaining what CareerBridge does and how to get started.

Grounding — the most important rule:
- Facts about CareerBridge, its pages, its internships, companies, deadlines, stipends and the person you're talking to \
come ONLY from the SITE KNOWLEDGE and the context below. Never use outside knowledge for these, and never guess.
- If the answer isn't in that context, say plainly that you don't have that information on CareerBridge, and point \
them to the page most likely to help.
- General career guidance is fine without context: interview practice, how to learn a skill, writing help, \
resume and cover-letter advice.
- Politely decline anything unrelated to careers, learning or this platform.

How you answer:
- Reply in the language the person writes or speaks in (Hindi, Tamil, Bengali, English, …), in that language's own
  script — e.g. Hindi in Devanagari. If they mix Hindi and English (Hinglish), reply the same way.
- Be warm, direct and practical. Lead with the answer; keep most replies under 180 words unless asked for more.
- Use Markdown: short paragraphs, bullet lists, **bold** for key points. No tables, no headings above level 3.
- When you mention an internship from the list in your context, link it exactly as [Title at Company](/internships/ID). \
Only recommend internships that appear in that list — never invent listings, companies, stipends or deadlines.
- Useful pages you can link: [Browse internships](/internships), [My applications](/dashboard/student/applications), \
[My profile](/dashboard/student/profile), [My skills](/dashboard/student/skills), [Sign up](/register), [Sign in](/login).
- When you explain a match, say which skills match and which are missing, and suggest how to close the gap.
- If you don't know something about the user or the platform, say so and suggest where they can find it. Don't guess \
personal details.
- You advise; people decide. Never claim to have applied, changed data, or contacted anyone — you can't take actions.
- Never use gender, age, religion, caste or other personal characteristics to judge or rank candidates.
- Stay on careers, learning, internships and this platform. For anything else (sport, news, trivia, general \
knowledge, homework…) do not answer it at all, not even briefly or "for fun" — say it's outside what you can help \
with on CareerBridge, and offer what you can do instead.
"""

SITE_KNOWLEDGE = """\
SITE KNOWLEDGE — how CareerBridge works:
- Three kinds of accounts: students (find and apply for internships), company recruiters (post internships and \
review applicants) and university representatives (follow their students' placements). Companies are verified \
before their listings count as verified.
- Signing up: choose a role, add name, username, email and password, then confirm a 6-digit code emailed to you. \
You can also sign up or sign in with Google; Google sign-ups then pick their role, gender, name and username once.
- Forgot password: on the sign-in page, "Forgot password?" emails a 6-digit code; enter it, then choose a new password.
- Skill matching: each internship lists required and nice-to-have skills. A student's match score compares their \
skills with those — required skills count three times as much as nice-to-have ones — and shows which skills match \
and which are missing. Adding skills on the Skills page raises the score. The skill level (beginner, intermediate, \
advanced) is shown to recruiters but does not change the score.
- Applying: students apply from an internship's page, optionally with a cover letter, and can withdraw. An \
application moves through Applied → Under review → Shortlisted → Selected or Rejected; students see the status \
on their Applications page.
- Student profile: degree, branch, graduation year, CGPA, bio, LinkedIn and GitHub links, resume upload, \
experience, certifications, achievements and skills with a level (beginner, intermediate, advanced).
- Recruiters post internships with title, description, location, work mode (on-site, hybrid, remote), stipend, \
duration, openings, deadline and required skills, and update each applicant's status.
- Pages: Browse internships (/internships), Applications (/dashboard/student/applications), Profile \
(/dashboard/student/profile), Skills (/dashboard/student/skills), Sign up (/register), Sign in (/login).
- Bridge (you) is the assistant in the corner of every page; typing /help lists what you can do, and the mic lets \
people talk to you and hear answers.
"""

CONTINUED_NOTE = (
    "The person interrupted your answer and kept talking; their last message joins what they said before with what "
    "they added. If the two parts belong together, answer them as one request. If the new part is a different "
    "question, answer just the new part."
)


def language_note(lang: str) -> str:
    return f"The person is speaking {lang}. Reply in {lang}, in its own script."


VOICE_NOTE = (
    "This reply will be read aloud. Answer in at most 60 words of plain conversational sentences — "
    "no Markdown, no lists, no links, no emoji."
)


def _internships_for(student_skills: list[str] | None):
    today = timezone.localdate()
    qs = (
        Internship.objects.filter(status=Internship.Status.PUBLISHED, deadline__gte=today)
        .select_related("company")
        .prefetch_related("internship_skills__skill")
        .order_by("deadline")[:40]
    )
    lines = []
    for i in qs:
        skills = [{"name": s.skill.name, "is_required": s.is_required} for s in i.internship_skills.all()]
        req = ", ".join(s["name"] for s in skills if s["is_required"]) or "none listed"
        pref = ", ".join(s["name"] for s in skills if not s["is_required"])
        line = (
            f"- ID {i.id}: {i.title} at {i.company.name} · {i.get_work_mode_display()}"
            f"{' · ' + i.location if i.location else ''} · stipend ₹{int(i.stipend):,}/month · "
            f"{i.duration_months} months · deadline {i.deadline:%d %b %Y} · required: {req}"
            f"{' · nice to have: ' + pref if pref else ''}"
        )
        if student_skills is not None:
            m = calculate_skill_match(student_skills, skills)
            line += f" · this student's skill match: {m['score']}%"
            if m.get("missing_required"):
                line += f" (missing: {', '.join(m['missing_required'])})"
        lines.append(line)
    return lines


def user_context(user) -> str:
    """A plain-text briefing about the person and the open internships. Changes per user, so it is sent after the
    fixed instructions."""
    today = timezone.localdate()
    parts = [f"Today is {today:%A, %d %B %Y}."]

    if not user or not user.is_authenticated:
        parts.append("The visitor is not signed in. You know nothing about them.")
        lines = _internships_for(None)
    else:
        name = user.get_full_name() or user.username
        parts.append(f"You are talking to {name} (username {user.username}), whose role is {user.get_role_display()}.")
        student_skills = None
        if user.role == "student":
            profile = getattr(user, "student_profile", None)
            if profile:
                student_skills = [s.skill.name for s in profile.student_skills.select_related("skill")]
                facts = []
                if profile.university_id:
                    facts.append(f"university: {profile.university.name}")
                for label, value in (("degree", profile.degree), ("branch", profile.branch),
                                     ("graduation year", profile.graduation_year), ("CGPA", profile.cgpa)):
                    if value:
                        facts.append(f"{label}: {value}")
                facts.append("resume uploaded" if (profile.resume_file or profile.resume_url) else "no resume uploaded yet")
                parts.append("Profile — " + "; ".join(facts) + ".")
                skills = [f"{s.skill.name} ({s.proficiency})" for s in profile.student_skills.select_related("skill")]
                parts.append("Skills: " + (", ".join(skills) if skills else "none added yet") + ".")
                exp = [f"{e.title} at {e.company}" for e in profile.experiences.all()[:6]]
                if exp:
                    parts.append("Experience: " + "; ".join(exp) + ".")
                apps = profile.applications.select_related("internship__company").order_by("-applied_at")[:10]
                if apps:
                    parts.append(
                        "Applications: "
                        + "; ".join(f"{a.internship.title} at {a.internship.company.name} — {a.get_status_display()}" for a in apps)
                        + "."
                    )
                else:
                    parts.append("Applications: none yet.")
            else:
                parts.append("They haven't filled in their student profile yet.")
        lines = _internships_for(student_skills)

    parts.append(
        f"Open internships right now ({len(lines)}):\n" + ("\n".join(lines) if lines else "- none are open at the moment")
    )
    return "\n\n".join(parts)
