"""Who belongs where: the company a recruiter works for, the university a placement officer runs."""

from rest_framework.exceptions import PermissionDenied

from .models import CompanyMembership, UniversityStaff


def company_membership(user):
    """The user's active company membership, or None."""
    if not user or not user.is_authenticated:
        return None
    return CompanyMembership.objects.filter(user=user, is_active=True).select_related("company").first()


def require_membership(user, *, manage=False, admin=False):
    """The membership, or a 403 explaining what's missing."""
    m = company_membership(user)
    if m is None:
        raise PermissionDenied("Set up or join your company first.")
    if admin and m.role != CompanyMembership.Role.ADMIN:
        raise PermissionDenied("Only a company admin can do this.")
    if manage and not m.can_manage_pipeline:
        raise PermissionDenied("Interviewers can view candidates but not change their stage.")
    return m


def university_staff(user):
    if not user or not user.is_authenticated:
        return None
    return UniversityStaff.objects.filter(user=user).select_related("university").first()


def require_staff(user, *, admin=False):
    s = university_staff(user)
    if s is None:
        raise PermissionDenied("Link your account to your university first.")
    if admin and not s.is_admin:
        raise PermissionDenied("Only the placement cell admin can do this.")
    return s
