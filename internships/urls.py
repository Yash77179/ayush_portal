"""URL patterns for internships app."""

from django.urls import path
from .views import (
    SkillListView,
    InternshipListView,
    InternshipDetailView,
    CompanyInternshipListCreateView,
    CompanyInternshipDetailView,
    StudentSkillListCreateView,
    StudentSkillDestroyView,
    eligibility_view,
    skill_match_view,
)

urlpatterns = [
    path("skills/", SkillListView.as_view(), name="skill-list"),
    path("", InternshipListView.as_view(), name="internship-list"),
    path("<int:pk>/", InternshipDetailView.as_view(), name="internship-detail"),
    path("<int:internship_id>/match/", skill_match_view, name="skill-match"),
    path("<int:internship_id>/eligibility/", eligibility_view, name="internship-eligibility"),
    path("my/", CompanyInternshipListCreateView.as_view(), name="company-internship-list"),
    path("my/<int:pk>/", CompanyInternshipDetailView.as_view(), name="company-internship-detail"),
    path("student-skills/", StudentSkillListCreateView.as_view(), name="student-skill-list"),
    path("student-skills/<int:pk>/", StudentSkillDestroyView.as_view(), name="student-skill-delete"),
]
