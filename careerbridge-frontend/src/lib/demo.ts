/**
 * Sample data used while a dashboard has nothing real to show, so the design
 * can be reviewed at full density. Disable with NEXT_PUBLIC_DEMO_DATA=off.
 */

export interface StudentStats {
  total_applications: number
  applied: number
  shortlisted: number
  selected: number
  rejected: number
  skills_count: number
  profile_completion: number
  recent_applications: { id: number; internship_title: string; company: string; status: string; applied_at: string }[]
  status_breakdown: { status: string; count: number }[]
}

export interface CompanyStats {
  total_internships: number
  published_internships: number
  total_applicants: number
  shortlisted: number
  selected: number
  rejected: number
  recent_applications: { id: number; student_name: string; internship_title: string; status: string; applied_at: string }[]
  status_breakdown: { status: string; count: number }[]
}

export interface UniversityStats {
  total_students: number
  total_published_internships: number
  total_applications: number
  total_placements: number
  verified_companies: number
  placement_rate: number
  top_skills: { skill__name: string; count: number }[]
  university?: string | null
  linked?: boolean
  verified_students?: number
  pending_verification?: number
  in_interviews?: number
  offers_pending?: number
  recent_activity?: { id: number; student_name: string; internship_title: string; company: string; status: string; updated_at: string }[]
}

export const DEMO_ENABLED = process.env.NEXT_PUBLIC_DEMO_DATA !== "off"

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

export const demoStudent: StudentStats = {
  total_applications: 14,
  applied: 5,
  shortlisted: 4,
  selected: 2,
  rejected: 1,
  skills_count: 6,
  profile_completion: 75,
  status_breakdown: [
    { status: "applied", count: 5 },
    { status: "review", count: 2 },
    { status: "shortlisted", count: 4 },
    { status: "selected", count: 2 },
    { status: "rejected", count: 1 },
  ],
  recent_applications: [
    { id: 1, internship_title: "Frontend Developer Intern", company: "Zoho Corporation", status: "shortlisted", applied_at: ago(1) },
    { id: 2, internship_title: "Data Analyst Intern", company: "Razorpay", status: "applied", applied_at: ago(2) },
    { id: 3, internship_title: "Backend Engineer Intern", company: "Freshworks", status: "selected", applied_at: ago(4) },
    { id: 4, internship_title: "Product Design Intern", company: "CRED", status: "review", applied_at: ago(6) },
    { id: 5, internship_title: "ML Research Intern", company: "Sarvam AI", status: "rejected", applied_at: ago(9) },
  ],
}

export const demoCompany: CompanyStats = {
  total_internships: 6,
  published_internships: 4,
  total_applicants: 38,
  shortlisted: 9,
  selected: 3,
  rejected: 7,
  status_breakdown: [
    { status: "applied", count: 14 },
    { status: "review", count: 5 },
    { status: "shortlisted", count: 9 },
    { status: "selected", count: 3 },
    { status: "rejected", count: 7 },
  ],
  recent_applications: [
    { id: 1, student_name: "Ananya Iyer", internship_title: "Frontend Developer Intern", status: "shortlisted", applied_at: ago(1) },
    { id: 2, student_name: "Rohan Mehta", internship_title: "Data Analyst Intern", status: "applied", applied_at: ago(2) },
    { id: 3, student_name: "Ishita Kapoor", internship_title: "Backend Engineer Intern", status: "selected", applied_at: ago(3) },
    { id: 4, student_name: "Kabir Singh", internship_title: "Product Design Intern", status: "applied", applied_at: ago(5) },
    { id: 5, student_name: "Meera Nair", internship_title: "Frontend Developer Intern", status: "rejected", applied_at: ago(6) },
  ],
}

export const demoUniversity: UniversityStats = {
  total_students: 412,
  total_published_internships: 58,
  total_applications: 960,
  total_placements: 143,
  verified_companies: 31,
  placement_rate: 14.9,
  top_skills: ["Python", "React", "SQL", "Java", "Figma", "Django", "Node.js", "Excel", "Docker", "C++"].map(
    (skill__name, i) => ({ skill__name, count: 120 - i * 11 })
  ),
}

export const isEmptyStudent = (s: StudentStats) => s.total_applications === 0 && s.skills_count === 0
export const isEmptyCompany = (s: CompanyStats) => s.total_internships === 0 && s.total_applicants === 0
export const isEmptyUniversity = (s: UniversityStats) => s.total_students === 0

/* ── List-page samples ─────────────────────────────────────────────────── */

export interface ApplicationRow {
  id: number
  status: string
  cover_letter: string
  applied_at: string
  internship: { id: number; title: string; company_name: string; work_mode: string; location: string }
  interviews?: import("@/lib/ats").StudentInterview[]
  offer?: import("@/lib/ats").Offer | null
}
export interface SkillRow {
  id: number
  skill: { id: number; name: string; category: string }
  proficiency: string
}
export interface InternshipRow {
  id: number
  title: string
  company_name: string
  location: string
  work_mode: string
  stipend: string
  openings: number
  deadline: string
  status: string
  skills_count: number
  created_at: string
  applicants?: number
  active_applicants?: number
}
export interface ApplicantRow {
  id: number
  status: string
  applied_at: string
  cover_letter: string
  recruiter_notes: string
  internship: { title: string }
  student: { user_name: string; user_email: string; degree: string; branch: string; university: { name: string } | null }
}

const ahead = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

export const demoApplications: ApplicationRow[] = [
  { id: 1, status: "shortlisted", cover_letter: "", applied_at: ago(1), internship: { id: 1, title: "Frontend Developer Intern", company_name: "Zoho Corporation", work_mode: "hybrid", location: "Chennai" } },
  { id: 2, status: "applied", cover_letter: "", applied_at: ago(2), internship: { id: 2, title: "Data Analyst Intern", company_name: "Razorpay", work_mode: "remote", location: "Bengaluru" } },
  { id: 3, status: "selected", cover_letter: "", applied_at: ago(4), internship: { id: 3, title: "Backend Engineer Intern", company_name: "Freshworks", work_mode: "onsite", location: "Chennai" } },
  { id: 4, status: "review", cover_letter: "", applied_at: ago(6), internship: { id: 4, title: "Product Design Intern", company_name: "CRED", work_mode: "hybrid", location: "Bengaluru" } },
  { id: 5, status: "applied", cover_letter: "", applied_at: ago(7), internship: { id: 5, title: "DevOps Intern", company_name: "Postman", work_mode: "remote", location: "Bengaluru" } },
  { id: 6, status: "rejected", cover_letter: "", applied_at: ago(9), internship: { id: 6, title: "ML Research Intern", company_name: "Sarvam AI", work_mode: "onsite", location: "Bengaluru" } },
]

export const demoSkills: SkillRow[] = [
  { id: 1, skill: { id: 1, name: "React", category: "Frontend" }, proficiency: "advanced" },
  { id: 2, skill: { id: 2, name: "TypeScript", category: "Frontend" }, proficiency: "intermediate" },
  { id: 3, skill: { id: 3, name: "Python", category: "Backend" }, proficiency: "advanced" },
  { id: 4, skill: { id: 4, name: "Django", category: "Backend" }, proficiency: "intermediate" },
  { id: 5, skill: { id: 5, name: "SQL", category: "Data" }, proficiency: "intermediate" },
  { id: 6, skill: { id: 6, name: "Figma", category: "Design" }, proficiency: "beginner" },
]

export const demoInternships: InternshipRow[] = [
  { id: 1, title: "Frontend Developer Intern", company_name: "Nova Tech", location: "Bengaluru", work_mode: "hybrid", stipend: "25000", openings: 3, deadline: ahead(12), status: "published", skills_count: 5, created_at: ago(10) },
  { id: 2, title: "Data Analyst Intern", company_name: "Nova Tech", location: "Remote", work_mode: "remote", stipend: "20000", openings: 2, deadline: ahead(20), status: "published", skills_count: 4, created_at: ago(8) },
  { id: 3, title: "Backend Engineer Intern", company_name: "Nova Tech", location: "Pune", work_mode: "onsite", stipend: "30000", openings: 2, deadline: ahead(6), status: "published", skills_count: 6, created_at: ago(15) },
  { id: 4, title: "Product Design Intern", company_name: "Nova Tech", location: "Bengaluru", work_mode: "hybrid", stipend: "18000", openings: 1, deadline: ahead(25), status: "draft", skills_count: 3, created_at: ago(2) },
  { id: 5, title: "QA Automation Intern", company_name: "Nova Tech", location: "Pune", work_mode: "onsite", stipend: "15000", openings: 2, deadline: ahead(-4), status: "closed", skills_count: 4, created_at: ago(40) },
]

export const demoApplicants: ApplicantRow[] = [
  { id: 1, status: "shortlisted", applied_at: ago(1), cover_letter: "I have built three React apps and love clean UI work.", recruiter_notes: "", internship: { title: "Frontend Developer Intern" }, student: { user_name: "Ananya Iyer", user_email: "ananya.iyer@example.com", degree: "B.Tech", branch: "CSE", university: { name: "VIT Vellore" } } },
  { id: 2, status: "applied", applied_at: ago(2), cover_letter: "", recruiter_notes: "", internship: { title: "Data Analyst Intern" }, student: { user_name: "Rohan Mehta", user_email: "rohan.mehta@example.com", degree: "B.Sc", branch: "Statistics", university: { name: "Delhi University" } } },
  { id: 3, status: "selected", applied_at: ago(3), cover_letter: "", recruiter_notes: "Strong fundamentals.", internship: { title: "Backend Engineer Intern" }, student: { user_name: "Ishita Kapoor", user_email: "ishita.k@example.com", degree: "B.Tech", branch: "IT", university: { name: "IIIT Hyderabad" } } },
  { id: 4, status: "review", applied_at: ago(5), cover_letter: "", recruiter_notes: "", internship: { title: "Product Design Intern" }, student: { user_name: "Kabir Singh", user_email: "kabir.singh@example.com", degree: "B.Des", branch: "Interaction Design", university: { name: "NID Ahmedabad" } } },
  { id: 5, status: "applied", applied_at: ago(6), cover_letter: "", recruiter_notes: "", internship: { title: "Frontend Developer Intern" }, student: { user_name: "Meera Nair", user_email: "meera.nair@example.com", degree: "B.Tech", branch: "ECE", university: { name: "NIT Calicut" } } },
  { id: 6, status: "rejected", applied_at: ago(8), cover_letter: "", recruiter_notes: "", internship: { title: "Backend Engineer Intern" }, student: { user_name: "Arjun Rao", user_email: "arjun.rao@example.com", degree: "BCA", branch: "Computer Applications", university: { name: "Christ University" } } },
]
