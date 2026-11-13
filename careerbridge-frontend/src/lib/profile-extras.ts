"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { apiFetch } from "@/lib/api"
import { DEMO_ENABLED } from "@/lib/demo"
import { mediaUrl } from "@/lib/format"

export interface Experience {
  id: number
  title: string
  company: string
  location: string
  start_date: string
  end_date: string | null
  is_current: boolean
  description: string
}
export interface Certification {
  id: number
  name: string
  issuer: string
  issued_on: string | null
  credential_id: string
  credential_url: string
  file: string | null
}
export interface Achievement {
  id: number
  title: string
  detail: string
  achieved_on: string | null
}
export interface DetectedSkill {
  id: number
  name: string
  already_added: boolean
}

const BASE = "/institutions/student-profile"

/* ── Sample data, shown while a section is empty ─────────────────────────── */
const DEMO_EXPERIENCE: Experience[] = [
  {
    id: -4,
    title: "Software Engineer",
    company: "Zoho Corporation",
    location: "Chennai",
    start_date: "2025-09-01",
    end_date: null,
    is_current: true,
    description: "Own the onboarding flow of a customer-facing product used by 40k+ teams\nLead the migration of legacy screens to a shared design system",
  },
  {
    id: -1,
    title: "Frontend Developer Intern",
    company: "Zoho Corporation",
    location: "Chennai",
    start_date: "2025-05-01",
    end_date: "2025-07-31",
    is_current: false,
    description:
      "Built reusable React components for an internal analytics dashboard\nCut page load time by 32% with code-splitting and image optimisation\nShipped 14 production pull requests reviewed by senior engineers",
  },
  {
    id: -2,
    title: "Freelance Web Developer",
    company: "Self-employed",
    location: "Remote",
    start_date: "2024-06-01",
    end_date: "2025-03-31",
    is_current: false,
    description: "Designed and developed 5 websites for local businesses\nManaged requirements, delivery and hosting end to end",
  },
  {
    id: -3,
    title: "Teaching Assistant, Data Structures",
    company: "Department of Computer Science",
    location: "Campus",
    start_date: "2024-01-01",
    end_date: "2024-05-31",
    is_current: false,
    description: "Ran weekly doubt-clearing sessions for 60 students\nCreated practice sets on trees, graphs and dynamic programming",
  },
]
const DEMO_CERTS: Certification[] = [
  { id: -1, name: "AWS Certified Cloud Practitioner", issuer: "Amazon Web Services", issued_on: "2025-03-14", credential_id: "AWS-CCP-84201", credential_url: "", file: "demo" },
  { id: -2, name: "Google UX Design Certificate", issuer: "Google · Coursera", issued_on: "2024-11-02", credential_id: "GUX-55719", credential_url: "", file: "demo" },
  { id: -3, name: "Meta Front-End Developer", issuer: "Meta · Coursera", issued_on: "2024-08-21", credential_id: "MFE-30128", credential_url: "", file: null },
]
const DEMO_ACHIEVEMENTS: Achievement[] = [
  { id: -1, title: "Winner, Smart India Hackathon (internal round)", detail: "Led a team of 6 to build a rural-health appointment app.", achieved_on: "2025-02-10" },
  { id: -2, title: "Top 5% in LeetCode Weekly Contest", detail: "Ranked 412 of 9,800 participants.", achieved_on: "2024-12-08" },
  { id: -3, title: "Dean’s List", detail: "Academic excellence, semesters 3 and 4.", achieved_on: "2024-06-30" },
]
export const DEMO_DETECTED: DetectedSkill[] = [
  { id: -1, name: "Python", already_added: false },
  { id: -2, name: "React", already_added: false },
  { id: -3, name: "SQL", already_added: false },
  { id: -4, name: "Git", already_added: false },
  { id: -5, name: "TypeScript", already_added: false },
  { id: -6, name: "Figma", already_added: false },
  { id: -7, name: "Data Structures", already_added: false },
]

const list = <T,>(d: unknown): T[] => (Array.isArray(d) ? (d as T[]) : ((d as { results?: T[] })?.results ?? []))

/** Experience, certifications and achievements for the signed-in student (with sample data while empty). */
export function useProfileExtras() {
  const [experience, setExperience] = useState<Experience[]>([])
  const [certs, setCerts] = useState<Certification[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const [e, c, a] = await Promise.all([
      apiFetch(`${BASE}/experience/`).catch(() => []),
      apiFetch(`${BASE}/certifications/`).catch(() => []),
      apiFetch(`${BASE}/achievements/`).catch(() => []),
    ])
    setExperience(list<Experience>(e))
    setCerts(list<Certification>(c).map((x) => ({ ...x, file: mediaUrl(x.file) })))
    setAchievements(list<Achievement>(a))
    setLoaded(true)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn()
      await load()
      toast.success(ok)
      return true
    } catch {
      toast.error("Something went wrong. Please try again.")
      return false
    }
  }

  const show = <T,>(real: T[], demo: T[]) => (loaded && real.length === 0 && DEMO_ENABLED ? { items: demo, isDemo: true } : { items: real, isDemo: false })

  return {
    loaded,
    experience: show(experience, DEMO_EXPERIENCE),
    certs: show(certs, DEMO_CERTS),
    achievements: show(achievements, DEMO_ACHIEVEMENTS),
    addExperience: (b: Partial<Experience>) => run(() => apiFetch(`${BASE}/experience/`, { method: "POST", body: b }), "Experience added"),
    removeExperience: (id: number) => run(() => apiFetch(`${BASE}/experience/${id}/`, { method: "DELETE" }), "Experience removed"),
    addCert: (form: FormData) => run(() => apiFetch(`${BASE}/certifications/`, { method: "POST", body: form }), "Certification added"),
    removeCert: (id: number) => run(() => apiFetch(`${BASE}/certifications/${id}/`, { method: "DELETE" }), "Certification removed"),
    addAchievement: (b: Partial<Achievement>) => run(() => apiFetch(`${BASE}/achievements/`, { method: "POST", body: b }), "Achievement added"),
    removeAchievement: (id: number) => run(() => apiFetch(`${BASE}/achievements/${id}/`, { method: "DELETE" }), "Achievement removed"),
  }
}

/** Upload a PDF resume; the server reads it and suggests skills. */
export async function uploadResume(file: File) {
  const form = new FormData()
  form.append("file", file)
  return apiFetch<{ resume_file: string; detected_skills: DetectedSkill[] }>(`${BASE}/resume/`, { method: "POST", body: form })
}
