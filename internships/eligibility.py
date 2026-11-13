"""Eligibility rules and screening answers — shared by internships and campus placement drives."""


def _norm(value):
    return "".join(ch for ch in str(value).lower() if ch.isalnum())


def split_list(value):
    return [p.strip() for p in str(value or "").split(",") if p.strip()]


def check_rules(profile, *, min_cgpa=None, branches="", degrees="", year_min=None, year_max=None):
    """Reasons the student doesn't qualify (empty list = eligible). Missing profile data counts as not meeting a rule."""
    reasons = []
    if min_cgpa is not None:
        if profile.cgpa is None:
            reasons.append(f"Add your CGPA to your profile — a minimum of {min_cgpa} is required.")
        elif profile.cgpa < min_cgpa:
            reasons.append(f"Needs a CGPA of at least {min_cgpa} (yours is {profile.cgpa}).")
    allowed = split_list(branches)
    if allowed and _norm(profile.branch) not in {_norm(b) for b in allowed}:
        reasons.append(f"Open to these branches only: {', '.join(allowed)}.")
    allowed = split_list(degrees)
    if allowed and _norm(profile.degree) not in {_norm(d) for d in allowed}:
        reasons.append(f"Open to these degrees only: {', '.join(allowed)}.")
    if year_min or year_max:
        y = profile.graduation_year
        if y is None:
            reasons.append("Add your graduation year to your profile.")
        elif (year_min and y < year_min) or (year_max and y > year_max):
            span = f"{year_min or '…'}–{year_max or '…'}" if year_min != year_max else str(year_min)
            reasons.append(f"Open to students graduating in {span}.")
    return reasons


def internship_reasons(profile, internship):
    return check_rules(
        profile,
        min_cgpa=internship.min_cgpa,
        branches=internship.allowed_branches,
        degrees=internship.allowed_degrees,
        year_min=internship.graduation_year_min,
        year_max=internship.graduation_year_max,
    )


def clean_answers(internship, raw_answers):
    """Validate answers to the screening questions.

    Returns (answers, errors, knocked_out): answers is the list stored on the application,
    errors maps question id → message, knocked_out lists the questions answered with a non-qualifying answer.
    """
    given = {}
    for item in raw_answers or []:
        if isinstance(item, dict) and str(item.get("question_id", "")).isdigit():
            given[int(item["question_id"])] = str(item.get("answer", "")).strip()[:2000]

    answers, errors, knocked = [], {}, []
    for q in internship.screening_questions.all():
        value = given.get(q.id, "")
        if not value:
            if q.required:
                errors[str(q.id)] = "Please answer this question."
            continue
        if q.kind == "yesno" and value.lower() not in ("yes", "no"):
            errors[str(q.id)] = "Answer yes or no."
            continue
        if q.kind == "choice" and value not in (q.choices or []):
            errors[str(q.id)] = "Pick one of the options."
            continue
        answers.append({"question_id": q.id, "question": q.text, "answer": value})
        if q.knockout_answer and q.kind in ("yesno", "choice") and _norm(value) != _norm(q.knockout_answer):
            knocked.append(q.text)
    return answers, errors, knocked
