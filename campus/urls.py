from django.urls import path

from . import views

urlpatterns = [
    # placement cell
    path("my-university/", views.MyUniversityView.as_view(), name="my-university"),
    path("my-university/staff/<int:pk>/", views.staff_member, name="university-staff-member"),
    path("students/", views.student_list, name="campus-students"),
    path("students/verify-bulk/", views.verify_bulk, name="campus-verify-bulk"),
    path("students/<int:pk>/", views.student_detail, name="campus-student-detail"),
    path("students/<int:pk>/verify/", views.verify_student, name="campus-student-verify"),
    path("drives/", views.DriveListView.as_view(), name="campus-drives"),
    path("drives/options/", views.drive_options, name="campus-drive-options"),
    path("drives/<int:pk>/", views.DriveDetailView.as_view(), name="campus-drive-detail"),
    path("drives/<int:drive_id>/registrations/<int:pk>/", views.update_registration, name="campus-registration"),
    path("announcements/", views.AnnouncementListView.as_view(), name="campus-announcements"),
    path("announcements/<int:pk>/", views.AnnouncementDetailView.as_view(), name="campus-announcement-detail"),
    path("reports/", views.placement_report, name="campus-report"),
    path("reports/export/", views.report_csv, name="campus-report-csv"),
    # students
    path("student/", views.student_campus, name="student-campus"),
    path("student/drives/<int:pk>/register/", views.drive_register, name="student-drive-register"),
]
