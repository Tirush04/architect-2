import type { Blueprint } from "@/lib/schemas";
import { titleFromPrompt } from "@/lib/utils";

export type Scenario = { id: string; keywords: RegExp; blueprint: Blueprint };

export const SCENARIOS: Scenario[] = [
  {
    id: "disputes",
    keywords: /dispute|chargeback|credit card|transaction|fraud|bank/i,
    blueprint: {
      appName: "DisputeDesk",
      tagline: "Resolve card disputes in hours, not weeks.",
      summary:
        "A workspace for the payments team to triage credit-card disputes. An intake agent reads incoming dispute emails, pulls the matching transaction, and drafts a resolution; a reviewer approves or escalates.",
      audience: "Payments operations analysts",
      pages: [
        { name: "Queue", purpose: "Every open dispute, ranked by SLA risk", components: ["KPI cards", "Dispute table", "Agent console"] },
        { name: "Dispute detail", purpose: "Evidence, transaction history and the agent's draft", components: ["Timeline", "Evidence list", "Approve / escalate"] },
        { name: "Insights", purpose: "Win rate and root causes by merchant", components: ["Charts", "Merchant leaderboard"] },
        { name: "Settings", purpose: "SLA rules and team routing", components: ["Rules editor"] },
      ],
      dataModel: [
        {
          entity: "Dispute",
          fields: [
            { name: "ref", type: "string" },
            { name: "customer", type: "string" },
            { name: "amount", type: "currency" },
            { name: "reason", type: "string" },
            { name: "opened", type: "date" },
            { name: "status", type: "status" },
          ],
        },
      ],
      agents: [
        {
          name: "Intake Agent",
          role: "Reads dispute emails, extracts the claim and links the transaction.",
          instructions:
            "You triage credit-card disputes. Extract cardholder, amount, merchant and reason code. Look up the matching transaction and attach it. Never promise a refund; flag fraud indicators for a human.",
          tools: ["read_inbox", "lookup_transaction", "create_dispute"],
          trigger: "New email in disputes@",
        },
        {
          name: "Resolution Agent",
          role: "Drafts a resolution letter and recommends accept, reject or escalate.",
          instructions:
            "Given a dispute and its evidence, recommend accept, reject or escalate with a one-paragraph rationale that cites the evidence. Draft the customer letter in a calm, plain tone.",
          tools: ["search_policy", "draft_letter"],
          trigger: "Dispute moves to In review",
        },
      ],
      integrations: ["Gmail", "Stripe", "Slack"],
      theme: { accent: "#2346d8", mode: "light" },
    },
  },
  {
    id: "support",
    keywords: /support|helpdesk|ticket|customer service|faq|chatbot/i,
    blueprint: {
      appName: "Helpline",
      tagline: "An AI front desk that knows your docs.",
      summary:
        "A support inbox where an answer agent resolves common questions from your knowledge base, and hands anything tricky to a human with a summary attached.",
      audience: "Customer support teams",
      pages: [
        { name: "Inbox", purpose: "Tickets with AI-drafted replies", components: ["Ticket list", "Reply composer"] },
        { name: "Knowledge base", purpose: "Docs the agent answers from", components: ["Article list", "Upload"] },
        { name: "Analytics", purpose: "Deflection rate and CSAT", components: ["Charts"] },
      ],
      dataModel: [
        {
          entity: "Ticket",
          fields: [
            { name: "id", type: "string" },
            { name: "customer", type: "string" },
            { name: "email", type: "email" },
            { name: "subject", type: "string" },
            { name: "created", type: "date" },
            { name: "status", type: "status" },
          ],
        },
      ],
      agents: [
        {
          name: "Answer Agent",
          role: "Answers tickets from the knowledge base with citations.",
          instructions:
            "Answer only from the knowledge base and cite the article. If confidence is low or the customer is upset, hand off to a human with a two-line summary.",
          tools: ["search_knowledge_base", "reply_to_ticket", "handoff_to_human"],
          trigger: "New ticket created",
        },
      ],
      integrations: ["Zendesk", "Slack", "Notion"],
      theme: { accent: "#0f766e", mode: "light" },
    },
  },
  {
    id: "recruiting",
    keywords: /recruit|hiring|candidate|resume|interview|applicant|talent/i,
    blueprint: {
      appName: "Shortlist",
      tagline: "Screen 500 applicants before lunch.",
      summary:
        "An applicant tracker where a screening agent scores each resume against the job's must-haves and a scheduler agent books interviews with shortlisted candidates.",
      audience: "Recruiters and hiring managers",
      pages: [
        { name: "Pipeline", purpose: "Candidates by stage", components: ["Kanban", "Scorecards"] },
        { name: "Roles", purpose: "Open roles and their must-haves", components: ["Role editor"] },
        { name: "Interviews", purpose: "Upcoming interviews", components: ["Calendar"] },
      ],
      dataModel: [
        {
          entity: "Candidate",
          fields: [
            { name: "name", type: "string" },
            { name: "email", type: "email" },
            { name: "role", type: "string" },
            { name: "score", type: "number" },
            { name: "applied", type: "date" },
            { name: "status", type: "status" },
          ],
        },
      ],
      agents: [
        {
          name: "Screening Agent",
          role: "Scores resumes against the role's must-haves with evidence.",
          instructions:
            "Score each resume 0-100 against the must-haves. Quote the resume line that proves each match. Never infer age, gender or ethnicity.",
          tools: ["parse_resume", "score_candidate"],
          trigger: "New application received",
        },
        {
          name: "Scheduler Agent",
          role: "Books interviews with shortlisted candidates.",
          instructions: "Offer three slots from the interviewer's calendar and confirm by email.",
          tools: ["check_calendar", "send_email"],
          trigger: "Candidate moved to Shortlisted",
        },
      ],
      integrations: ["Google Calendar", "Gmail", "Greenhouse"],
      theme: { accent: "#7c3aed", mode: "light" },
    },
  },
  {
    id: "sales",
    keywords: /sales|crm|lead|pipeline|deal|prospect|outreach/i,
    blueprint: {
      appName: "Pipeline Pilot",
      tagline: "A CRM that researches and follows up for you.",
      summary:
        "A lightweight CRM where a research agent enriches every new lead and a follow-up agent drafts personalised emails when deals go quiet.",
      audience: "Founders and small sales teams",
      pages: [
        { name: "Deals", purpose: "Every deal and its next step", components: ["Deal table", "Stage filters"] },
        { name: "Leads", purpose: "New leads with enrichment", components: ["Lead cards"] },
        { name: "Forecast", purpose: "Weighted pipeline", components: ["Charts"] },
      ],
      dataModel: [
        {
          entity: "Deal",
          fields: [
            { name: "company", type: "string" },
            { name: "owner", type: "string" },
            { name: "value", type: "currency" },
            { name: "closeDate", type: "date" },
            { name: "status", type: "status" },
          ],
        },
      ],
      agents: [
        {
          name: "Research Agent",
          role: "Enriches new leads with company size, funding and a talking point.",
          instructions: "Find company size, recent funding and one relevant talking point. Cite sources.",
          tools: ["web_search", "update_lead"],
          trigger: "New lead added",
        },
        {
          name: "Follow-up Agent",
          role: "Drafts a personalised nudge when a deal has no activity for 7 days.",
          instructions: "Draft a short, specific follow-up referencing the last conversation. Never send without approval.",
          tools: ["read_thread", "draft_email"],
          trigger: "Deal idle for 7 days",
        },
      ],
      integrations: ["Gmail", "HubSpot", "LinkedIn"],
      theme: { accent: "#c2410c", mode: "light" },
    },
  },
];

export function genericBlueprint(prompt: string): Blueprint {
  const name = titleFromPrompt(prompt);
  return {
    appName: name,
    tagline: `${name}, with agents doing the busywork.`,
    summary: `An app for: ${prompt.slice(0, 220)}${prompt.length > 220 ? "…" : ""}. An assistant agent handles the repetitive steps and asks you before anything important.`,
    audience: "Your team",
    pages: [
      { name: "Dashboard", purpose: "What needs your attention today", components: ["KPI cards", "Activity table", "Agent console"] },
      { name: "Records", purpose: "Everything the app tracks", components: ["Table", "Filters"] },
      { name: "Automations", purpose: "What your agents do and when", components: ["Agent list"] },
      { name: "Settings", purpose: "Team, integrations and preferences", components: ["Forms"] },
    ],
    dataModel: [
      {
        entity: "Item",
        fields: [
          { name: "id", type: "string" },
          { name: "title", type: "string" },
          { name: "owner", type: "string" },
          { name: "updated", type: "date" },
          { name: "status", type: "status" },
        ],
      },
    ],
    agents: [
      {
        name: "Assistant Agent",
        role: "Handles the repetitive steps of the workflow and flags exceptions.",
        instructions:
          "Complete routine steps automatically. For anything irreversible or unusual, ask a human first and explain why.",
        tools: ["search_records", "update_record", "notify_team"],
        trigger: "New item created",
      },
    ],
    integrations: ["Slack", "Google Sheets"],
    theme: { accent: "#2346d8", mode: "light" },
  };
}

export function pickScenario(prompt: string): Blueprint {
  const hit = SCENARIOS.find((s) => s.keywords.test(prompt));
  return structuredClone(hit ? hit.blueprint : genericBlueprint(prompt));
}
