/**
 * The admin dashboard's API (Django: accounts/admin_api.py, under /api/admin/). It works on the same database as
 * Django's own /admin/ panel, so a change here shows there straight away, and the other way round.
 */
import { apiFetch } from "@/lib/api"

export type Role = "student" | "company" | "university" | "admin"

export interface AdminUser {
  id: number
  username: string
  name: string
  first_name: string
  last_name: string
  email: string
  role: Role
  is_active: boolean
  is_superuser: boolean
  org: string
  photo: string | null
  date_joined: string
  last_login: string | null
}

export interface AdminUserDetail extends AdminUser {
  phone: string
  gender: string
  profile_completed: boolean
  memberships: { company_id: number; company: string; role: string; is_active: boolean }[]
  student: { university: string; degree: string; branch: string; graduation_year: number | null; applications: number; selected: number } | null
  university_staff: string
  is_you: boolean
}

export interface AdminCompany {
  id: number
  name: string
  industry: string
  location: string
  website: string
  size: string
  is_verified: boolean
  logo: string | null
  created_at: string
  members: number
  internships: number
  live: number
}

export interface AdminCompanyDetail extends AdminCompany {
  description: string
  culture: string
  founded_year: number | null
  linkedin_url: string
  team: { user_id: number; name: string; email: string; role: string; is_active: boolean }[]
  openings: { id: number; title: string; status: string; applicants: number; created_at: string }[]
  sizes: Record<string, string>
}

const qs = (params: Record<string, string>) => {
  const p = new URLSearchParams(Object.entries(params).filter(([, v]) => v))
  const s = p.toString()
  return s ? `?${s}` : ""
}

export const getAdminUsers = (params: Record<string, string>) =>
  apiFetch<{ count: number; results: AdminUser[]; roles: Record<Role, number>; inactive: number }>(`/admin/users/${qs(params)}`)
export const getAdminUser = (id: number) => apiFetch<AdminUserDetail>(`/admin/users/${id}/`)
export const updateAdminUser = (id: number, body: Partial<Pick<AdminUserDetail, "first_name" | "last_name" | "email" | "phone" | "role" | "is_active">>) =>
  apiFetch<AdminUserDetail>(`/admin/users/${id}/`, { method: "PATCH", body })
export const setAdminUserPassword = (id: number, password: string) =>
  apiFetch<{ detail: string }>(`/admin/users/${id}/password/`, { method: "POST", body: { password } })

export const getAdminCompanies = (params: Record<string, string>) =>
  apiFetch<{ count: number; results: AdminCompany[]; verified: number; unverified: number }>(`/admin/companies/${qs(params)}`)
export const getAdminCompany = (id: number) => apiFetch<AdminCompanyDetail>(`/admin/companies/${id}/`)
export const updateAdminCompany = (id: number, body: Record<string, unknown>) =>
  apiFetch<AdminCompanyDetail>(`/admin/companies/${id}/`, { method: "PATCH", body })

/** someone asking to run a university's placement cell that has no admin yet (approving makes them its head admin) */
export interface UniversityAccessRequest {
  id: number
  name: string
  email: string
  username: string
  title: string
  university: string
  location: string
  requested_at: string
}
export const getUniversityRequests = () => apiFetch<UniversityAccessRequest[]>("/admin/university-requests/")
export const approveUniversityRequest = (id: number) => apiFetch(`/admin/university-requests/${id}/`, { method: "POST" })
export const declineUniversityRequest = (id: number) => apiFetch(`/admin/university-requests/${id}/`, { method: "DELETE" })

export const ROLE_LABEL: Record<Role, string> = { student: "Student", company: "Recruiter", university: "University", admin: "Admin" }

export const fmtDay = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Never"
