"""CareerBridge root URL configuration."""

from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from django.views.static import serve
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)


def health(_request):
    """For Fly.io's health check: the app process is up (no database call, so a slow DB doesn't restart the app)."""
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
    # Uploaded files. Django's `static()` helper only works with DEBUG on, so serve them directly:
    # on Fly there is no separate web server in front, and the files live on the persistent volume.
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
]
