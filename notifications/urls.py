from django.urls import path

from .views import mark_read, notification_list

urlpatterns = [
    path("", notification_list, name="notification-list"),
    path("read/", mark_read, name="notification-read"),
]
