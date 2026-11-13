#!/usr/bin/env bash
# Render build step. Runs on every deploy; every command here is safe to repeat.
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate --no-input

# Reference data the app needs: the skills catalogue (matching, profiles) and the university list (sign-up, placement cell).
python manage.py seed_skills
# The university list comes from a public API; if it's down, deploy anyway — it fills in on the next deploy.
python manage.py import_universities || echo "University import skipped (source unavailable)."
