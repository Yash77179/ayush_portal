from django.contrib import admin

from .models import Announcement, DriveRegistration, PlacementDrive


class RegistrationInline(admin.TabularInline):
    model = DriveRegistration
    extra = 0


@admin.register(PlacementDrive)
class PlacementDriveAdmin(admin.ModelAdmin):
    list_display = ["title", "university", "display_company", "drive_date", "status"]
    list_filter = ["status", "university"]
    inlines = [RegistrationInline]


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ["title", "university", "pinned", "created_at"]
