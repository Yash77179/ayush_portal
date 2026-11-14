"""URL patterns for the admin dashboard API (see admin_api.py)."""

from django.urls import path

from . import admin_api

urlpatterns = [
    path("users/", admin_api.users, name="admin-users"),
    path("users/<int:pk>/", admin_api.user_detail, name="admin-user"),
    path("users/<int:pk>/password/", admin_api.user_set_password, name="admin-user-password"),
    path("companies/", admin_api.companies, name="admin-companies"),
    path("companies/<int:pk>/", admin_api.company_detail, name="admin-company"),
    path("university-requests/", admin_api.university_requests, name="admin-university-requests"),
    path("university-requests/<int:pk>/", admin_api.university_request_decide, name="admin-university-request"),
]
