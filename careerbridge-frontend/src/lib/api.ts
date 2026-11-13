/**
 * CareerBridge API client
 * Handles JWT token storage, refresh, and all API calls to the Django backend.
 */

const CONFIGURED_API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

/**
 * The API address, as seen from this browser. When it's configured as this machine (localhost / 127.0.0.1) but
 * the site was opened from another device — your phone on the same Wi-Fi, or through a tunnel — "localhost" would
 * mean the phone itself. Then the API is called on the site's own address, under /backend/, and the Next.js server
 * passes it on to Django (see rewrites in next.config.ts).
 */
export function resolveApiUrl(configured = CONFIGURED_API) {
  if (typeof window === "undefined") return configured
  try {
    const url = new URL(configured)
    const local = (h: string) => h === "localhost" || h === "127.0.0.1" || h === "[::1]"
    if (local(url.hostname) && !local(window.location.hostname)) return `${window.location.origin}/backend${url.pathname.replace(/\/$/, "")}`
    return url.toString().replace(/\/$/, "")
  } catch {
    return configured
  }
}

const API_BASE = resolveApiUrl();

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiOptions {
  method?: HttpMethod;
  body?: unknown;
  auth?: boolean;
}

function getTokens() {
  if (typeof window === "undefined") return { access: null, refresh: null };
  return {
    access: localStorage.getItem("cb_access"),
    refresh: localStorage.getItem("cb_refresh"),
  };
}

function setTokens(access: string, refresh: string) {
  localStorage.setItem("cb_access", access);
  localStorage.setItem("cb_refresh", refresh);
}

export function clearTokens() {
  localStorage.removeItem("cb_access");
  localStorage.removeItem("cb_refresh");
}

async function refreshAccessToken(): Promise<string | null> {
  const { refresh } = getTokens();
  if (!refresh) return null;
  const res = await fetch(`${API_BASE}/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) {
    clearTokens();
    return null;
  }
  const data = await res.json();
  localStorage.setItem("cb_access", data.access);
  return data.access;
}

export const API_URL = API_BASE;

/**
 * The current access token (refreshed first if it's missing), or null for visitors.
 * For requests apiFetch can't make — e.g. reading a streamed response.
 */
export async function getAccessToken({ forceRefresh = false } = {}): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const { access, refresh } = getTokens();
  if (access && !forceRefresh) return access;
  if (!refresh) return null;
  return refreshAccessToken();
}

export async function apiFetch<T = unknown>(
  path: string,
  { method = "GET", body, auth = true }: ApiOptions = {}
): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers: Record<string, string> = isForm ? {} : { "Content-Type": "application/json" };
  const payload = isForm ? (body as FormData) : body ? JSON.stringify(body) : undefined;

  if (auth) {
    let { access } = getTokens();
    if (!access) {
      access = await refreshAccessToken();
    }
    if (access) {
      headers["Authorization"] = `Bearer ${access}`;
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: payload,
  });

  // If 401, try refresh once
  if (res.status === 401 && auth) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      headers["Authorization"] = `Bearer ${newAccess}`;
      const retried = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: payload,
      });
      if (!retried.ok) throw new Error(await retried.text());
      return retried.json() as Promise<T>;
    }
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────
export async function login(username: string, password: string) {
  const data = await apiFetch<{ access: string; refresh: string }>(
    "/token/",
    { method: "POST", body: { username, password }, auth: false }
  );
  setTokens(data.access, data.refresh);
  return data;
}

/** Google sign-in: the server checks Google's access token and answers with our own JWT pair (creating the account the first time). */
export async function googleLogin(accessToken: string, role?: string) {
  const data = await apiFetch<{ access: string; refresh: string; created: boolean; user: { profile_completed?: boolean } }>("/accounts/google/", {
    method: "POST",
    body: { access_token: accessToken, role },
    auth: false,
  });
  setTokens(data.access, data.refresh);
  return data;
}

/** The one-time "finish your profile" step after a Google sign-up. */
export async function completeProfile(data: { role: string; gender: string; first_name: string; last_name: string; username: string }) {
  return apiFetch("/accounts/complete-profile/", { method: "POST", body: data });
}

export type RegisterPayload = {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  gender?: string;
  password: string;
  password2: string;
};

export type OtpSent = { message: string; expires_in: number; resend_in: number };

/** Sign-up, part 1: the server checks the form and emails a 6-digit code. Nothing is saved yet. */
export async function sendRegisterOtp(payload: RegisterPayload) {
  return apiFetch<OtpSent>("/accounts/register/send-otp/", { method: "POST", body: payload, auth: false });
}

/** Sign-up, part 2: the same form plus the code; the account is created only if the code is right. */
export async function register(payload: RegisterPayload & { otp: string }) {
  return apiFetch("/accounts/register/", { method: "POST", body: payload, auth: false });
}

export async function sendPasswordResetOtp(email: string) {
  return apiFetch<OtpSent>("/accounts/password-reset/send-otp/", { method: "POST", body: { email }, auth: false });
}

/** Checks a reset code without using it up, so the next screen can ask for the new password. */
export async function verifyPasswordResetOtp(email: string, otp: string) {
  return apiFetch<{ message: string }>("/accounts/password-reset/verify-otp/", { method: "POST", body: { email, otp }, auth: false });
}

export async function confirmPasswordReset(payload: { email: string; otp: string; password: string; password2: string }) {
  return apiFetch<{ message: string; username: string }>("/accounts/password-reset/confirm/", {
    method: "POST",
    body: payload,
    auth: false,
  });
}

/**
 * A readable message from a failed request. The backend answers with Django REST Framework's JSON
 * (`{"detail": "…"}` or `{"field": ["…"]}`), which apiFetch passes through as the error text.
 */
export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again.") {
  if (!(err instanceof Error)) return fallback;
  try {
    const data = JSON.parse(err.message);
    const first = (v: unknown): string | undefined =>
      typeof v === "string" ? v : Array.isArray(v) ? first(v[0]) : v && typeof v === "object" ? first(Object.values(v)[0]) : undefined;
    if (data && typeof data === "object" && "detail" in data) return first(data.detail) ?? fallback;
    return first(data) ?? fallback;
  } catch {
    return err.message && err.message.length < 200 && !err.message.startsWith("<") ? err.message : fallback;
  }
}

export async function uploadProfilePhoto(file: File) {
  const form = new FormData();
  form.append("profile_photo", file);
  return apiFetch("/accounts/profile/", { method: "PATCH", body: form });
}

export async function getMe() {
  return apiFetch("/accounts/me/");
}

// ── Internships ───────────────────────────────────────────────────────────
export async function getInternships(params?: Record<string, string>) {
  const query = params ? "?" + new URLSearchParams(params).toString() : "";
  return apiFetch(`/internships/${query}`, { auth: false });
}

export async function getInternship(id: number) {
  return apiFetch(`/internships/${id}/`, { auth: false });
}

export async function getSkillMatch(internshipId: number) {
  return apiFetch(`/internships/${internshipId}/match/`);
}

export async function getSkills(search?: string) {
  const q = search ? `?search=${search}` : "";
  return apiFetch(`/internships/skills/${q}`, { auth: false });
}

// ── Student ───────────────────────────────────────────────────────────────
export async function getStudentProfile() {
  return apiFetch("/institutions/student-profile/");
}

export async function updateStudentProfile(data: Record<string, unknown>) {
  return apiFetch("/institutions/student-profile/", { method: "PATCH", body: data });
}

export async function getStudentSkills() {
  return apiFetch("/internships/student-skills/");
}

export async function addStudentSkill(skillId: number, proficiency: string) {
  return apiFetch("/internships/student-skills/", {
    method: "POST",
    body: { skill_id: skillId, proficiency },
  });
}

export async function deleteStudentSkill(id: number) {
  return apiFetch(`/internships/student-skills/${id}/`, { method: "DELETE" });
}

// ── Applications ──────────────────────────────────────────────────────────
export async function getMyApplications() {
  return apiFetch("/applications/");
}

export async function applyToInternship(internshipId: number, coverLetter: string, answers: { question_id: number; answer: string }[] = []) {
  return apiFetch("/applications/", {
    method: "POST",
    body: { internship_id: internshipId, cover_letter: coverLetter, answers },
  });
}

export async function withdrawApplication(id: number) {
  return apiFetch(`/applications/${id}/withdraw/`, { method: "DELETE" });
}

// ── Recruiter ─────────────────────────────────────────────────────────────
export async function getRecruiterApplications(internshipId?: number) {
  const q = internshipId ? `?internship=${internshipId}` : "";
  return apiFetch(`/applications/recruiter/${q}`);
}

export async function updateApplicationStatus(id: number, status: string, notes?: string) {
  return apiFetch(`/applications/recruiter/${id}/status/`, {
    method: "PATCH",
    body: { status, recruiter_notes: notes },
  });
}

export async function getMyInternships() {
  return apiFetch("/internships/my/");
}

export async function createInternship(data: Record<string, unknown>) {
  return apiFetch("/internships/my/", { method: "POST", body: data });
}

// ── Analytics ─────────────────────────────────────────────────────────────
export async function getStudentStats() {
  return apiFetch("/analytics/student/");
}

export async function getCompanyStats() {
  return apiFetch("/analytics/company/");
}

export async function getUniversityStats() {
  return apiFetch("/analytics/university/");
}

// ── Institutions ──────────────────────────────────────────────────────────
export async function getUniversities() {
  return apiFetch("/institutions/universities/", { auth: false });
}

export async function searchUniversities(query: string) {
  const q = query ? `?search=${encodeURIComponent(query)}` : "";
  return apiFetch(`/institutions/universities/${q}`, { auth: false });
}

export async function createUniversity(name: string) {
  return apiFetch("/institutions/universities/", { method: "POST", body: { name } });
}

export async function getCompanies() {
  return apiFetch("/institutions/companies/", { auth: false });
}
