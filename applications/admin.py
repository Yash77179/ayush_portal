from django.contrib import admin

from .models import Application, ApplicationEvent, EmailTemplate, Interview, InterviewFeedback, Offer


class EventInline(admin.TabularInline):
    model = ApplicationEvent
    extra = 0
    readonly_fields = ["kind", "actor", "from_status", "to_status", "detail", "created_at"]


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ["student", "internship", "status", "source", "applied_at"]
    list_filter = ["status", "source"]
    inlines = [EventInline]


@admin.register(Interview)
class InterviewAdmin(admin.ModelAdmin):
    list_display = ["application", "round_name", "scheduled_at", "status", "candidate_response"]


admin.site.register(InterviewFeedback)
admin.site.register(Offer)
admin.site.register(EmailTemplate)
