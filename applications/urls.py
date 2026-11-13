"""URL patterns for applications app."""

from django.urls import path

from . import views

urlpatterns = [
    # student
    path("", views.StudentApplicationListCreateView.as_view(), name="application-list-create"),
    path("<int:pk>/", views.StudentApplicationDetailView.as_view(), name="application-detail"),
    path("<int:pk>/withdraw/", views.ApplicationWithdrawView.as_view(), name="application-withdraw"),
    path("interviews/<int:pk>/respond/", views.interview_respond, name="interview-respond"),
    path("interviews/<int:pk>/ics/", views.interview_ics, name="interview-ics"),
    path("offers/<int:pk>/", views.offer_detail, name="offer-detail"),
    path("offers/<int:pk>/respond/", views.offer_respond, name="offer-respond"),
    # recruiter (ATS)
    path("recruiter/", views.RecruiterApplicationListView.as_view(), name="recruiter-applications"),
    path("recruiter/export/", views.export_csv, name="recruiter-export"),
    path("recruiter/analytics/", views.recruiter_analytics, name="recruiter-analytics"),
    path("recruiter/bulk/", views.bulk_action, name="recruiter-bulk"),
    path("recruiter/interviews/", views.company_interviews, name="recruiter-interviews"),
    path("recruiter/interviews/<int:pk>/", views.update_interview, name="recruiter-interview-update"),
    path("recruiter/interviews/<int:pk>/feedback/", views.interview_feedback, name="recruiter-interview-feedback"),
    path("recruiter/offers/<int:pk>/withdraw/", views.withdraw_offer, name="recruiter-offer-withdraw"),
    path("recruiter/notes/<int:pk>/", views.delete_note, name="recruiter-note-delete"),
    path("recruiter/templates/", views.EmailTemplateListView.as_view(), name="recruiter-templates"),
    path("recruiter/templates/<int:pk>/", views.EmailTemplateDetailView.as_view(), name="recruiter-template-detail"),
    path("recruiter/<int:pk>/", views.RecruiterApplicationDetailView.as_view(), name="recruiter-application-detail"),
    path("recruiter/<int:pk>/status/", views.RecruiterApplicationStatusUpdateView.as_view(), name="update-status"),
    path("recruiter/<int:pk>/notes/", views.add_note, name="recruiter-note-add"),
    path("recruiter/<int:pk>/rating/", views.set_rating, name="recruiter-rating"),
    path("recruiter/<int:pk>/tags/", views.set_tags, name="recruiter-tags"),
    path("recruiter/<int:pk>/email/", views.email_candidate, name="recruiter-email"),
    path("recruiter/<int:pk>/interviews/", views.schedule_interview, name="recruiter-interview-create"),
    path("recruiter/<int:pk>/offer/", views.make_offer, name="recruiter-offer-create"),
]
