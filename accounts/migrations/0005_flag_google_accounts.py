"""
Accounts that came in through Google before the "finish your profile" step existed have no password
(Django marks those with a leading "!") and may be missing a gender or role choice: send them through it.
"""

from django.db import migrations


def flag(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(password__startswith="!", is_superuser=False).update(profile_completed=False)


class Migration(migrations.Migration):
    dependencies = [("accounts", "0004_user_profile_completed")]

    operations = [migrations.RunPython(flag, migrations.RunPython.noop)]
