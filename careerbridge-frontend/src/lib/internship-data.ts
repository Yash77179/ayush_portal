/** Shared types and sample listings for the public internships pages. */

export interface BrowseInternship {
  id: number
  title: string
  company_name: string
  company_logo: string | null
  location: string
  work_mode: string
  stipend: string
  duration_months: number
  deadline: string
  status: string
  openings: number
  skills_count: number
}

export interface InternshipDetail {
  id: number
  title: string
  company: {
    id: number
    name: string
    website: string
    description: string
    industry: string
    size: string
    location: string
    logo: string | null
    is_verified: boolean
  }
  description: string
  location: string
  work_mode: string
  stipend: string
  duration_months: number
  openings: number
  screening_questions?: { id: number; text: string; kind: "text" | "yesno" | "choice"; choices: string[]; required: boolean }[]
  min_cgpa?: string | null
  allowed_branches?: string
  allowed_degrees?: string
  graduation_year_min?: number | null
  graduation_year_max?: number | null
  deadline: string
  status: string
  created_at?: string
  internship_skills: { skill: { id: number; name: string; category: string }; is_required: boolean }[]
}

export interface SkillMatch {
  score: number
  matched_required: string[]
  missing_required: string[]
  matched_preferred: string[]
  total_required: number
  total_preferred: number
}

export const MODE_LABEL: Record<string, string> = { onsite: "On-site", hybrid: "Hybrid", remote: "Remote" }
export const MODE_NOTE: Record<string, string> = {
  onsite: "Interns work from the office in the city above.",
  hybrid: "A mix of office days and remote days each week.",
  remote: "Fully remote — the city is just the team's base.",
}

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

type Seed = {
  title: string; company: string; city: string; mode: string; stipend: number; months: number
  openings: number; days: number; industry: string; size: string; about: string
  intro: string; does: string[]; learns: string[]
  required: [string, string][]; preferred: [string, string][]
}

const SEEDS: Seed[] = [
  {
    title: "Frontend Developer Intern", company: "Zoho Corporation", city: "Chennai", mode: "hybrid", stipend: 25000, months: 6, openings: 3, days: 12,
    industry: "Software", size: "large", about: "Zoho builds a suite of business software used by millions of people in 150+ countries.",
    intro: "Join the product UI team and help build fast, accessible interfaces used by millions of people.",
    does: ["Build reusable React components from Figma designs", "Fix bugs and improve performance across the web app", "Write tests and review code with your mentor"],
    learns: ["Modern React and TypeScript in a production codebase", "Accessibility and design systems", "How a large engineering team ships"],
    required: [["React", "Frontend"], ["TypeScript", "Frontend"], ["HTML & CSS", "Frontend"]], preferred: [["Figma", "Design"], ["Git", "Tools"]],
  },
  {
    title: "Data Analyst Intern", company: "Razorpay", city: "Bengaluru", mode: "remote", stipend: 22000, months: 3, openings: 2, days: 20,
    industry: "Fintech", size: "large", about: "Razorpay powers payments for hundreds of thousands of businesses across India.",
    intro: "Turn payments data into clear answers for product and growth teams.",
    does: ["Write SQL to answer product questions", "Build dashboards that track key metrics weekly", "Present findings to the team"],
    learns: ["Analytics at scale", "Experiment design and A/B testing", "Storytelling with data"],
    required: [["SQL", "Data"], ["Python", "Backend"], ["Excel", "Data"]], preferred: [["Tableau", "Data"]],
  },
  {
    title: "Backend Engineer Intern", company: "Freshworks", city: "Chennai", mode: "onsite", stipend: 30000, months: 6, openings: 2, days: 6,
    industry: "SaaS", size: "large", about: "Freshworks makes customer-engagement software that teams actually enjoy using.",
    intro: "Work with the platform team on APIs that serve millions of requests every day.",
    does: ["Design and ship REST APIs in Python", "Improve database queries and caching", "Add monitoring and write tests"],
    learns: ["Scalable service design", "Production debugging", "Code review culture"],
    required: [["Python", "Backend"], ["Django", "Backend"], ["SQL", "Data"]], preferred: [["Docker", "Tools"], ["Redis", "Backend"]],
  },
  {
    title: "Product Design Intern", company: "CRED", city: "Bengaluru", mode: "hybrid", stipend: 28000, months: 3, openings: 1, days: 25,
    industry: "Fintech", size: "medium", about: "CRED rewards people for managing their money well, with a design-first culture.",
    intro: "Design polished, delightful flows for a product used by millions.",
    does: ["Explore and prototype new flows in Figma", "Run quick usability tests", "Hand off designs to engineers"],
    learns: ["Design systems at craft level", "Working with product and engineering", "Motion and micro-interaction design"],
    required: [["Figma", "Design"], ["Prototyping", "Design"]], preferred: [["User research", "Design"]],
  },
  {
    title: "DevOps Intern", company: "Postman", city: "Bengaluru", mode: "remote", stipend: 26000, months: 4, openings: 2, days: 9,
    industry: "Developer tools", size: "medium", about: "Postman is the platform developers use to build and test APIs.",
    intro: "Help keep the infrastructure behind a developer favourite fast and reliable.",
    does: ["Automate deployments with CI/CD pipelines", "Monitor services and respond to alerts", "Document runbooks for the team"],
    learns: ["Cloud infrastructure", "Observability", "Incident response"],
    required: [["Docker", "Tools"], ["Linux", "Tools"], ["Git", "Tools"]], preferred: [["Kubernetes", "Tools"], ["AWS", "Cloud"]],
  },
  {
    title: "ML Research Intern", company: "Sarvam AI", city: "Bengaluru", mode: "onsite", stipend: 35000, months: 6, openings: 1, days: 30,
    industry: "AI", size: "startup", about: "Sarvam AI builds language models for Indian languages and use cases.",
    intro: "Contribute to research on multilingual language models with a small, senior team.",
    does: ["Run and track training experiments", "Evaluate models on Indic benchmarks", "Write up results for the team"],
    learns: ["Modern LLM training techniques", "Evaluation and data quality", "Research workflow end to end"],
    required: [["Python", "Backend"], ["PyTorch", "Data"], ["Machine learning", "Data"]], preferred: [["NLP", "Data"]],
  },
]

const toDescription = (s: Seed) => {
  const list = (items: string[]) => items.map((d) => `- ${d}`).join("\n")
  const team = s.title.replace(" Intern", "")
  return [
    s.intro,
    `${s.company}'s ${team} team is small, friendly and focused on craft. You'll be paired with a mentor from day one and work on real projects that ship, not busywork. Expect honest feedback, regular check-ins and room to grow into more ownership.`,
    `What you'll do\n${list(s.does)}`,
    `What we're looking for\n${list([
      ...s.required.map(([n]) => `Working knowledge of ${n}`),
      "Currently enrolled in, or recently graduated from, a relevant degree",
      "Curiosity, clear communication and the habit of asking good questions",
    ])}`,
    `What you'll learn\n${list(s.learns)}`,
    `Perks\n${list([
      "Certificate of completion and a letter of recommendation",
      "A dedicated mentor with weekly 1:1s",
      "Flexible hours around your classes and exams",
      "Pre-placement offer opportunity for top performers",
    ])}`,
    `Working hours\n${list(["About 30–40 hours a week", "Core overlap hours 11am–4pm IST", "Weekends off"])}`,
  ].join("\n\n")
}

export function makeSampleDetails(): InternshipDetail[] {
  let skillId = 1
  return SEEDS.map((s, i) => ({
    id: 9000 + i,
    title: s.title,
    company: {
      id: 100 + i, name: s.company, website: "https://example.com", description: s.about,
      industry: s.industry, size: s.size, location: s.city, logo: null, is_verified: true,
    },
    description: toDescription(s),
    location: s.city,
    work_mode: s.mode,
    stipend: String(s.stipend),
    duration_months: s.months,
    openings: s.openings,
    deadline: day(s.days),
    status: "published",
    created_at: new Date(Date.now() - (3 + i) * 86_400_000).toISOString(),
    internship_skills: [
      ...s.required.map(([name, category]) => ({ skill: { id: skillId++, name, category }, is_required: true })),
      ...s.preferred.map(([name, category]) => ({ skill: { id: skillId++, name, category }, is_required: false })),
    ],
  }))
}

export function makeSample(): BrowseInternship[] {
  return makeSampleDetails().map((d) => ({
    id: d.id, title: d.title, company_name: d.company.name, company_logo: null,
    location: d.location, work_mode: d.work_mode, stipend: d.stipend,
    duration_months: d.duration_months, deadline: d.deadline, status: d.status,
    openings: d.openings, skills_count: d.internship_skills.filter((s) => s.is_required).length,
  }))
}

/** Find a sample by id; small ids (from the sample company dashboard) map onto the same set. */
export function getSampleDetail(id: number): InternshipDetail {
  const all = makeSampleDetails()
  return all.find((d) => d.id === id) ?? all[Math.abs(id - 1) % all.length]
}

/** Parse the plain-text description into paragraphs and "heading + bullets" blocks. */
export function parseDescription(text: string): ({ kind: "p"; text: string } | { kind: "list"; heading: string; items: string[] })[] {
  return text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim())
      const bullets = lines.filter((l) => l.startsWith("- "))
      if (bullets.length && lines.length > bullets.length) {
        return { kind: "list" as const, heading: lines.filter((l) => !l.startsWith("- ")).join(" "), items: bullets.map((l) => l.slice(2)) }
      }
      if (bullets.length) return { kind: "list" as const, heading: "", items: bullets.map((l) => l.slice(2)) }
      return { kind: "p" as const, text: lines.join(" ") }
    })
}
