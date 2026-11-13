"""CareerBridge root URL configuration."""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
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
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
