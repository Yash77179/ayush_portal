"""Make sure the site has its admin account, from environment variables. Runs on every deploy (build.sh).

    DJANGO_ADMIN_PASSWORD   required; without it the command does nothing
    DJANGO_ADMIN_USERNAME   default "admin"
    DJANGO_ADMIN_EMAIL      default "admin@careerbridge.com"

If the account doesn't exist it is created. If it does, it's made sure to be an active superuser with the admin role,
and its password is set to DJANGO_ADMIN_PASSWORD: the environment is the source of truth, so to change the admin's
password, change the variable and redeploy. The password never lives in the code.
"""

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create or update the admin account from DJANGO_ADMIN_* environment variables."

    def handle(self, *args, **options):
        password = os.environ.get("DJANGO_ADMIN_PASSWORD", "")
        if not password:
            self.stdout.write("ensure_admin: DJANGO_ADMIN_PASSWORD isn't set, so the admin account was left as it is.")
            return
        username = os.environ.get("DJANGO_ADMIN_USERNAME", "admin").strip() or "admin"
        email = os.environ.get("DJANGO_ADMIN_EMAIL", "admin@careerbridge.com").strip()

        User = get_user_model()
        user = User.objects.filter(username=username).first()
        created = user is None
        if created:
            user = User(username=username, email=email)
        user.email = user.email or email
        user.role = "admin"
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.profile_completed = True
        user.set_password(password)
        user.save()
        self.stdout.write(f"ensure_admin: {'created' if created else 'updated'} the admin account '{username}'.")
