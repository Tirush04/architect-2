export type Template = {
  id: string;
  name: string;
  category: "Operations" | "Support" | "Sales" | "People" | "Internal tools";
  description: string;
  prompt: string;
  agents: number;
  accent: string;
};

export const TEMPLATES: Template[] = [
  {
    id: "dispute-desk",
    name: "Card dispute desk",
    category: "Operations",
    description: "Triage credit-card disputes from email, link transactions and draft resolutions.",
    prompt: "Build a credit card dispute management app where an agent reads dispute emails, links the transaction and drafts a resolution for review.",
    agents: 2,
    accent: "#2346d8",
  },
  {
    id: "helpline",
    name: "AI support inbox",
    category: "Support",
    description: "Answer tickets from your docs with citations; hand off tricky ones.",
    prompt: "Build a customer support helpdesk where an agent answers tickets from our knowledge base and hands off to a human when unsure.",
    agents: 1,
    accent: "#0f766e",
  },
  {
    id: "shortlist",
    name: "Resume screener",
    category: "People",
    description: "Score applicants against must-haves and book interviews automatically.",
    prompt: "Build a recruiting app that screens candidate resumes against role must-haves and schedules interviews with shortlisted candidates.",
    agents: 2,
    accent: "#7c3aed",
  },
  {
    id: "pipeline-pilot",
    name: "Self-driving CRM",
    category: "Sales",
    description: "Enrich new leads and draft follow-ups when deals go quiet.",
    prompt: "Build a sales CRM where an agent researches new leads and drafts follow-up emails when deals go quiet.",
    agents: 2,
    accent: "#c2410c",
  },
  {
    id: "expense-approver",
    name: "Expense approvals",
    category: "Internal tools",
    description: "Read receipts, check policy and route approvals.",
    prompt: "Build an expense approval tool where an agent reads receipts, checks them against our travel policy and routes them to the right approver.",
    agents: 1,
    accent: "#0369a1",
  },
  {
    id: "vendor-onboarding",
    name: "Vendor onboarding",
    category: "Operations",
    description: "Collect documents, verify tax IDs and chase missing items.",
    prompt: "Build a vendor onboarding portal where an agent collects documents, verifies details and chases vendors for anything missing.",
    agents: 1,
    accent: "#15803d",
  },
];

export function getTemplate(id: string | undefined | null) {
  return TEMPLATES.find((t) => t.id === id);
}
