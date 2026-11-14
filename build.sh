#!/usr/bin/env bash
# Render build step. Runs on every deploy; every command here is safe to repeat.
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate --no-input

# Reference data the app needs: the skills catalogue (matching, profiles) and the university list (sign-up, placement cell).
python manage.py seed_skills
# The admin account, from DJANGO_ADMIN_PASSWORD (set it in Render → Environment). Does nothing if it isn't set.
python manage.py ensure_admin
# The full demo world (8 universities, 16 companies, 180 students and their histories). Only when SEED_WORLD=1 is set
# in Render's Environment; it rebuilds it from scratch each deploy while set, so remove the variable once it's loaded.
if [ "${SEED_WORLD:-}" = "1" ]; then python manage.py seed_world --reset; fi
# The university list comes from a public API; if it's down, deploy anyway — it fills in on the next deploy.
python manage.py import_universities || echo "University import skipped (source unavailable)."
