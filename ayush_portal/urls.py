"""CareerBridge root URL configuration."""

from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from filestore.views import serve_media


def health(_request):
    """For the host's health check: the app process is up (no database call, so a slow DB doesn't restart the app)."""
    return JsonResponse({"ok": True})


urlpatterns = [
    path("api/health/", health, name="health"),
    path("admin/", admin.site.urls),
    # JWT auth endpoints
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # App API routes
    path("api/accounts/", include("accounts.urls")),
    path("api/institutions/", include("institutions.urls")),
    path("api/internships/", include("internships.urls")),
    path("api/applications/", include("applications.urls")),
    path("api/analytics/", include("analytics.urls")),
    path("api/assistant/", include("assistant.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/campus/", include("campus.urls")),
    # the site's own admin dashboard (users, companies); Django's panel stays at /admin/
    path("api/admin/", include("accounts.admin_urls")),
    # Uploaded files, from whichever storage is active (the media/ folder locally, the database in production).
    # Django's `static()` helper only works with DEBUG on, and there's no separate web server in front.
    re_path(r"^media/(?P<path>.*)$", serve_media, name="media"),
]
