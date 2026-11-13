from django.contrib import admin

from .models import EmailOTP


@admin.register(EmailOTP)
class EmailOTPAdmin(admin.ModelAdmin):
    list_display = ("email", "purpose", "created_at", "attempts", "used")
    list_filter = ("purpose", "used")
    search_fields = ("email",)
    readonly_fields = ("email", "purpose", "code_hash", "attempts", "used", "created_at")
