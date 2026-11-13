from django.contrib import admin

from .models import Company, CompanyMembership, StudentProfile, University, UniversityStaff


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ["name", "industry", "location", "is_verified", "created_at"]
    list_filter = ["is_verified", "size"]
    list_editable = ["is_verified"]
    search_fields = ["name"]


@admin.register(CompanyMembership)
class CompanyMembershipAdmin(admin.ModelAdmin):
    list_display = ["user", "company", "role", "is_active", "joined_at"]
    list_filter = ["role", "is_active"]


@admin.register(University)
class UniversityAdmin(admin.ModelAdmin):
    list_display = ["name", "location"]
    search_fields = ["name", "location"]


@admin.register(UniversityStaff)
class UniversityStaffAdmin(admin.ModelAdmin):
    list_display = ["user", "university", "is_admin", "title"]


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "university", "branch", "graduation_year", "cgpa", "verification_status"]
    list_filter = ["verification_status"]
    search_fields = ["user__username", "user__email", "user__first_name", "user__last_name"]
