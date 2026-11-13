/**
 * Recruiter hiring system (ATS), company/team, university placement cell and notifications —
 * types and API calls. Everything goes through apiFetch so tokens refresh the usual way.
 */
import { API_URL, apiFetch, getAccessToken } from "@/lib/api"

/* ── Stages ──────────────────────────────────────────────────────────────── */
export const PIPELINE = ["applied", "review", "shortlisted", "interview", "offered", "selected"] as const
export const ALL_STAGES = [...PIPELINE, "rejected"] as const
export type Stage = (typeof ALL_STAGES)[number]

export const STAGE_LABEL: Record<string, string> = {
  applied: "Applied",
  review: "Screening",
  shortlisted: "Shortlisted",
  interview: "Interview",
  offered: "Offer",
  selected: "Hired",
  rejected: "Rejected",
}

/* ── Types ───────────────────────────────────────────────────────────────── */
export interface ApplicantCard {
  id: number
  status: Stage
  source: "direct" | "drive" | "referral"
  tags: string[]
  applied_at: string
  status_changed_at: string | null
  viewed_at: string | null
  cover_letter: string
  recruiter_notes: string
  avg_rating: number | null
  my_rating: number | null
  match_score: number
  internship: { id: number; title: string }
  student: {
    id: number
    user_name: string
    user_email: string
    photo: string | null
    university: { name: string } | null
    degree: string
    branch: string
    cgpa: string | null
    graduation_year: number | null
    verification_status: string
  }
  next_interview: { id: number; scheduled_at: string; round_name: string; candidate_response: string } | null
  offer_status: string | null
}

export interface Feedback {
  id: number
  author_id: number
  author_name: string
  technical: number
  communication: number
  culture: number
  recommendation: "strong_yes" | "yes" | "no" | "strong_no"
  comments: string
  created_at: string
}

export interface Interview {
  id: number
  application_id: number
  round_name: string
  scheduled_at: string
  duration_minutes: number
  mode: "video" | "phone" | "onsite"
  meeting_link: string
  location: string
  instructions: string
  status: "scheduled" | "completed" | "cancelled"
  candidate_response: "pending" | "confirmed" | "reschedule"
  candidate_note: string
  interviewers: { id: number; name: string }[]
  feedback: Feedback[]
  candidate_name: string
  internship_title: string
}

export interface Offer {
  id: number
  role_title: string
  stipend: string
  start_date: string
  duration_months: number
  location: string
  expires_on: string
  message: string
  status: "pending" | "accepted" | "declined" | "withdrawn"
  is_expired: boolean
  response_note: string
  created_at: string
  responded_at: string | null
  company_name: string
  candidate_name: string
}

export interface TimelineEvent {
  id: number
  kind: string
  from_status: string
  to_status: string
  detail: string
  actor_name: string
  created_at: string
}

export interface CandidateDetail extends Omit<ApplicantCard, "student" | "internship" | "next_interview" | "offer_status"> {
  answers: { question_id: number; question: string; answer: string }[]
  match: { score: number; matched_required: string[]; missing_required: string[]; matched_preferred: string[] }
  internship: { id: number; title: string; stipend: string; duration_months: number; location: string }
  student: {
    id: number
    user_email: string
    user_name: string
    university: { name: string } | null
    degree: string
    branch: string
    graduation_year: number | null
    cgpa: string | null
    resume_url: string
    resume_file: string | null
    linkedin_url: string
    github_url: string
    bio: string
    enrollment_number: string
    verification_status: string
  }
  student_photo: string | null
  student_phone: string
  skills: { name: string; proficiency: string }[]
  experiences: { id: number; title: string; company: string; location: string; start_date: string; end_date: string | null; is_current: boolean; description: string }[]
  certifications: { id: number; name: string; issuer: string; issued_on: string | null; credential_url: string; file: string | null }[]
  achievements: { id: number; title: string; detail: string; achieved_on: string | null }[]
  notes: { id: number; body: string; author_id: number | null; author_name: string; created_at: string }[]
  ratings: { author_name: string; stars: number }[]
  events: TimelineEvent[]
  interviews: Interview[]
  offer: Offer | null
}

export interface EmailTemplate {
  id: number
  name: string
  subject: string
  body: string
}

export interface Company {
  id: number
  name: string
  website: string
  description: string
  industry: string
  size: string
  location: string
  logo: string | null
  is_verified: boolean
  culture: string
  founded_year: number | null
  linkedin_url: string
}

export interface MyCompany {
  id: number
  company: Company
  role: "admin" | "recruiter" | "interviewer"
  is_active: boolean
  member_count: number
}

export interface TeamMember {
  id: number
  user_id: number
  name: string
  email: string
  photo: string | null
  role: "admin" | "recruiter" | "interviewer"
  is_active: boolean
  joined_at: string
}

export interface ScreeningQuestion {
  id?: number
  text: string
  kind: "text" | "yesno" | "choice"
  choices: string[]
  required: boolean
  knockout_answer?: string
}

export interface ManagedInternship {
  id: number
  title: string
  description: string
  location: string
  work_mode: string
  stipend: string
  duration_months: number
  openings: number
  deadline: string
  status: "draft" | "published" | "closed"
  min_cgpa: string | null
  allowed_branches: string
  allowed_degrees: string
  graduation_year_min: number | null
  graduation_year_max: number | null
  internship_skills: { skill: { id: number; name: string; category: string }; is_required: boolean }[]
  screening_questions: ScreeningQuestion[]
}

export interface Analytics {
  total: number
  rejected: number
  funnel: { stage: string; label: string; count: number; current: number; conversion: number }[]
  time_to_hire_days: number | null
  time_in_stage_days: { stage: string; label: string; avg_days: number | null }[]
  sources: { source: string; label: string; count: number }[]
  offers: { sent: number; accepted: number; acceptance_rate: number | null }
  per_listing: { id: number; title: string; applicants: number; active: number; hired: number; rejected: number }[]
  upcoming_interviews: number
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const list = <T,>(d: unknown): T[] => (Array.isArray(d) ? d : ((d as { results?: T[] })?.results ?? [])) as T[]
const qs = (params?: Record<string, string | number | undefined | null>) => {
  const entries = Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== "")
  return entries.length ? "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString() : ""
}

/** Download an authenticated file (CSV, .ics) and save it. */
export async function downloadFile(path: string, filename: string) {
  let token = await getAccessToken()
  let res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (res.status === 401) {
    token = await getAccessToken({ forceRefresh: true })
    res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  }
  if (!res.ok) throw new Error(await res.text())
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ── Company & team ──────────────────────────────────────────────────────── */
export const getMyCompany = () => apiFetch<MyCompany>("/institutions/my-company/")
export const createCompany = (data: Partial<Company>) => apiFetch<MyCompany>("/institutions/my-company/", { method: "POST", body: data })
export const updateCompany = (data: Partial<Company> | FormData) => apiFetch<MyCompany>("/institutions/my-company/", { method: "PATCH", body: data })
export const getTeam = () => apiFetch<{ my_role: string; results: TeamMember[] }>("/institutions/my-company/team/")
export const addTeamMember = (email: string, role: string) => apiFetch<TeamMember>("/institutions/my-company/team/", { method: "POST", body: { email, role } })
export const updateTeamMember = (id: number, data: { role?: string; is_active?: boolean }) =>
  apiFetch<TeamMember>(`/institutions/my-company/team/${id}/`, { method: "PATCH", body: data })
export const removeTeamMember = (id: number) => apiFetch(`/institutions/my-company/team/${id}/`, { method: "DELETE" })
export const getPublicCompany = (id: number | string) =>
  apiFetch<Company & { open_roles: import("@/lib/demo").InternshipRow[]; team_size: number }>(`/institutions/companies/${id}/`, { auth: false })

/* ── Listings ────────────────────────────────────────────────────────────── */
export const getManagedInternship = (id: number | string) => apiFetch<ManagedInternship>(`/internships/my/${id}/`)
export const saveInternship = (data: Record<string, unknown>, id?: number | string) =>
  id ? apiFetch<ManagedInternship>(`/internships/my/${id}/`, { method: "PATCH", body: data }) : apiFetch<ManagedInternship>("/internships/my/", { method: "POST", body: data })
export const deleteInternship = (id: number) => apiFetch(`/internships/my/${id}/`, { method: "DELETE" })
export const getEligibility = (id: number) =>
  apiFetch<{ eligible: boolean; reasons: string[]; already_applied: boolean; profile_verified?: boolean }>(`/internships/${id}/eligibility/`)

/* ── Applicants ──────────────────────────────────────────────────────────── */
export const getApplicants = async (params?: { internship?: number | string; status?: string; tag?: string; q?: string; source?: string }) =>
  list<ApplicantCard>(await apiFetch(`/applications/recruiter/${qs(params)}`))
export const getCandidate = (id: number | string) => apiFetch<CandidateDetail>(`/applications/recruiter/${id}/`)
export const moveApplicant = (id: number, status: string, notify = true) =>
  apiFetch<ApplicantCard>(`/applications/recruiter/${id}/status/`, { method: "PATCH", body: { status, notify } })
export const addNote = (id: number, body: string) => apiFetch<CandidateDetail["notes"][number]>(`/applications/recruiter/${id}/notes/`, { method: "POST", body: { body } })
export const deleteNote = (noteId: number) => apiFetch(`/applications/recruiter/notes/${noteId}/`, { method: "DELETE" })
export const rateApplicant = (id: number, stars: number) =>
  apiFetch<{ my_rating: number | null; avg_rating: number | null }>(`/applications/recruiter/${id}/rating/`, { method: "PUT", body: { stars } })
export const setTags = (id: number, tags: string[]) => apiFetch<{ tags: string[] }>(`/applications/recruiter/${id}/tags/`, { method: "PUT", body: { tags } })
export const emailApplicant = (id: number, subject: string, body: string) =>
  apiFetch<{ sent: boolean }>(`/applications/recruiter/${id}/email/`, { method: "POST", body: { subject, body } })
export const bulkAction = (body: { ids: number[]; action: "move" | "tag" | "untag" | "email"; status?: string; tag?: string; subject?: string; body?: string; notify?: boolean }) =>
  apiFetch<{ updated: number; total: number }>("/applications/recruiter/bulk/", { method: "POST", body })
export const exportApplicants = (params?: { internship?: number | string; status?: string }) =>
  downloadFile(`/applications/recruiter/export/${qs(params)}`, "applicants.csv")
export const getAnalytics = (internship?: number | string) => apiFetch<Analytics>(`/applications/recruiter/analytics/${qs({ internship })}`)

/* ── Interviews ──────────────────────────────────────────────────────────── */
export const scheduleInterview = (applicationId: number, data: Record<string, unknown>) =>
  apiFetch<Interview>(`/applications/recruiter/${applicationId}/interviews/`, { method: "POST", body: data })
export const updateInterview = (id: number, data: Record<string, unknown>) =>
  apiFetch<Interview>(`/applications/recruiter/interviews/${id}/`, { method: "PATCH", body: data })
export const getCompanyInterviews = async (scope: "upcoming" | "past" | "mine" | "all" = "upcoming") =>
  list<Interview>(await apiFetch(`/applications/recruiter/interviews/${qs({ scope })}`))
export const submitFeedback = (interviewId: number, data: Partial<Feedback>) =>
  apiFetch<Feedback>(`/applications/recruiter/interviews/${interviewId}/feedback/`, { method: "POST", body: data })
export const downloadIcs = (interviewId: number) => downloadFile(`/applications/interviews/${interviewId}/ics/`, `interview-${interviewId}.ics`)

/* ── Offers ──────────────────────────────────────────────────────────────── */
export const makeOffer = (applicationId: number, data: Record<string, unknown>) =>
  apiFetch<Offer>(`/applications/recruiter/${applicationId}/offer/`, { method: "POST", body: data })
export const withdrawOffer = (offerId: number) => apiFetch<Offer>(`/applications/recruiter/offers/${offerId}/withdraw/`, { method: "POST" })
export type OfferLetter = Offer & {
  company: { name: string; location: string; website: string; logo: string | null }
  candidate_email: string
  signed_by: string
  internship_title: string
}
export const getOfferLetter = (id: number | string) => apiFetch<OfferLetter>(`/applications/offers/${id}/`)

/* ── Email templates ─────────────────────────────────────────────────────── */
export const getTemplates = async () => list<EmailTemplate>(await apiFetch("/applications/recruiter/templates/"))
export const saveTemplate = (data: Omit<EmailTemplate, "id">, id?: number) =>
  id ? apiFetch<EmailTemplate>(`/applications/recruiter/templates/${id}/`, { method: "PATCH", body: data }) : apiFetch<EmailTemplate>("/applications/recruiter/templates/", { method: "POST", body: data })
export const deleteTemplate = (id: number) => apiFetch(`/applications/recruiter/templates/${id}/`, { method: "DELETE" })

/* ── Student follow-up ───────────────────────────────────────────────────── */
export interface StudentInterview {
  id: number
  round_name: string
  scheduled_at: string
  duration_minutes: number
  mode: "video" | "phone" | "onsite"
  meeting_link: string
  location: string
  instructions: string
  status: string
  candidate_response: "pending" | "confirmed" | "reschedule"
  candidate_note: string
}
export interface StudentApplication {
  id: number
  status: Stage
  source: string
  cover_letter: string
  applied_at: string
  updated_at: string
  internship: { id: number; title: string; company_name: string; company_id?: number; work_mode: string; location: string }
  interviews: StudentInterview[]
  offer: Offer | null
  timeline?: TimelineEvent[]
}
export const getStudentApplication = (id: number) => apiFetch<StudentApplication>(`/applications/${id}/`)
export const respondToInterview = (id: number, response: "confirmed" | "reschedule", note = "") =>
  apiFetch(`/applications/interviews/${id}/respond/`, { method: "POST", body: { response, note } })
export const respondToOffer = (id: number, decision: "accept" | "decline", note = "") =>
  apiFetch<Offer>(`/applications/offers/${id}/respond/`, { method: "POST", body: { decision, note } })

/* ── University placement cell ───────────────────────────────────────────── */
export interface MyUniversity {
  university: { id: number; name: string; location: string; website: string; established_year: number | null; logo: string | null }
  is_admin: boolean
  title: string
  student_count: number
  staff: { id: number; name: string; email: string; title: string; is_admin: boolean }[]
}
export interface CampusStudent {
  id: number
  name: string
  email: string
  enrollment_number: string
  degree: string
  branch: string
  graduation_year: number | null
  cgpa: string | null
  verification_status: "unverified" | "verified" | "rejected"
  verification_note: string
  profile_completion: number
  skills: number
  applications: number
  active: number
  offers: number
  placed: boolean
}
export interface CampusStudentDetail extends CampusStudent {
  phone: string
  bio: string
  linkedin_url: string
  github_url: string
  resume: string | null
  skill_list: { name: string; proficiency: string }[]
  application_list: { id: number; internship: string; company: string; status: string; applied_at: string; stipend: string }[]
  drives: { id: number; title: string; date: string; attended: boolean; outcome: string }[]
}
export interface Drive {
  id: number
  title: string
  description: string
  company: number | null
  company_name: string
  company_display: string
  internship: number | null
  internship_title: string | null
  drive_date: string
  venue: string
  registration_deadline: string | null
  min_cgpa: string | null
  allowed_branches: string
  graduation_year: number | null
  status: "upcoming" | "ongoing" | "completed" | "cancelled"
  registrations_count: number
  eligible_count?: number
  created_at: string
}
export interface DriveRegistration {
  id: number
  student_id: number
  name: string
  email: string
  branch: string
  cgpa: string | null
  verification_status: string
  registered_at: string
  attended: boolean
  outcome: "pending" | "selected" | "not_selected"
}
export interface Announcement {
  id: number
  title: string
  body: string
  pinned: boolean
  author_name: string
  created_at: string
}
export interface PlacementReport {
  university: string
  generated_at: string
  total_students: number
  verified_students: number
  students_applied: number
  students_placed: number
  placement_rate: number
  total_applications: number
  offers_pending: number
  in_interviews: number
  stipend: { median: number | null; highest: number | null; average: number | null }
  top_recruiters: { company: string; hires: number }[]
  branches: { branch: string; students: number; placed: number; applied: number; rate: number }[]
  years: { year: string; students: number; placed: number }[]
  pipeline: { status: string; count: number }[]
  drives: { total: number; upcoming: number; registrations: number; selected: number }
  top_skills: { skill: string; count: number }[]
}

export const getMyUniversity = () => apiFetch<MyUniversity>("/campus/my-university/")
export const linkUniversity = (data: { university_id?: number; name?: string; location?: string; title?: string }) =>
  apiFetch<MyUniversity>("/campus/my-university/", { method: "POST", body: data })
export const updateUniversity = (data: Record<string, unknown> | FormData) => apiFetch<MyUniversity>("/campus/my-university/", { method: "PATCH", body: data })
export const updateStaff = (id: number, isAdmin: boolean) => apiFetch(`/campus/my-university/staff/${id}/`, { method: "PATCH", body: { is_admin: isAdmin } })
export const removeStaff = (id: number) => apiFetch(`/campus/my-university/staff/${id}/`, { method: "DELETE" })
export const getCampusStudents = (params?: Record<string, string>) =>
  apiFetch<{ results: CampusStudent[]; branches: string[] }>(`/campus/students/${qs(params)}`)
export const getCampusStudent = (id: number) => apiFetch<CampusStudentDetail>(`/campus/students/${id}/`)
export const verifyStudent = (id: number, data: { status: string; note?: string; enrollment_number?: string; cgpa?: string }) =>
  apiFetch<CampusStudent>(`/campus/students/${id}/verify/`, { method: "POST", body: data })
export const verifyStudentsBulk = (ids: number[]) => apiFetch<{ verified: number }>("/campus/students/verify-bulk/", { method: "POST", body: { ids } })
export const getDrives = async () => list<Drive>(await apiFetch("/campus/drives/"))
export const getDrive = (id: number) => apiFetch<Drive & { registrations: DriveRegistration[]; eligible_count: number }>(`/campus/drives/${id}/`)
export const saveDrive = (data: Record<string, unknown>, id?: number) =>
  id ? apiFetch<Drive>(`/campus/drives/${id}/`, { method: "PATCH", body: data }) : apiFetch<Drive>("/campus/drives/", { method: "POST", body: data })
export const deleteDrive = (id: number) => apiFetch(`/campus/drives/${id}/`, { method: "DELETE" })
export const getDriveOptions = () =>
  apiFetch<{ id: number; name: string; is_verified: boolean; internships: { id: number; title: string }[] }[]>("/campus/drives/options/")
export const updateRegistration = (driveId: number, id: number, data: { attended?: boolean; outcome?: string }) =>
  apiFetch<DriveRegistration>(`/campus/drives/${driveId}/registrations/${id}/`, { method: "PATCH", body: data })
export const getAnnouncements = async () => list<Announcement>(await apiFetch("/campus/announcements/"))
export const saveAnnouncement = (data: { title: string; body: string; pinned?: boolean }, id?: number) =>
  id ? apiFetch<Announcement>(`/campus/announcements/${id}/`, { method: "PATCH", body: data }) : apiFetch<Announcement>("/campus/announcements/", { method: "POST", body: data })
export const deleteAnnouncement = (id: number) => apiFetch(`/campus/announcements/${id}/`, { method: "DELETE" })
export const getPlacementReport = () => apiFetch<PlacementReport>("/campus/reports/")
export const exportPlacementReport = () => downloadFile("/campus/reports/export/", "placement-report.csv")

export interface StudentCampus {
  university: { id: number; name: string } | null
  verification_status?: string
  verification_note?: string
  drives: (Drive & { registered: boolean; outcome: string | null; eligible: boolean; reasons: string[]; registration_open: boolean })[]
  announcements: Announcement[]
}
export const getStudentCampus = () => apiFetch<StudentCampus>("/campus/student/")
export const registerForDrive = (id: number) =>
  apiFetch<{ registered: boolean; applied: boolean; needs_questions: boolean; internship_id: number | null }>(`/campus/student/drives/${id}/register/`, { method: "POST" })
export const unregisterFromDrive = (id: number) => apiFetch(`/campus/student/drives/${id}/register/`, { method: "DELETE" })

/* ── Notifications ───────────────────────────────────────────────────────── */
export interface AppNotification {
  id: number
  kind: string
  title: string
  body: string
  link: string
  is_read: boolean
  created_at: string
}
export const getNotifications = () => apiFetch<{ unread: number; results: AppNotification[] }>("/notifications/")
export const markNotificationsRead = (ids?: number[]) => apiFetch("/notifications/read/", { method: "POST", body: ids ? { ids } : {} })

/* ── Formatting ──────────────────────────────────────────────────────────── */
export const fmtDate = (d?: string | null, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  d ? new Date(d).toLocaleDateString("en-IN", opts) : "—"
export const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—"
export const fmtMoney = (v?: string | number | null) => (v === null || v === undefined || v === "" ? "—" : `₹${Number(v).toLocaleString("en-IN")}`)
export function timeAgo(d: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 1000))
  if (s < 60) return "just now"
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.round(h / 24)
  if (days < 30) return `${days}d ago`
  return fmtDate(d, { day: "numeric", month: "short" })
}
/** For <input type="datetime-local">: local time without seconds or zone. */
export const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
