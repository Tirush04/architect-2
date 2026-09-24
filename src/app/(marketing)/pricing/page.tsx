import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pricing" };

const PLANS = [
  {
    name: "Free",
    price: "$0",
    note: "forever",
    blurb: "Explore and ship a first agent.",
    features: ["25 AI builds / day", "3 projects", "Share links", "All agent frameworks", "Community support"],
    cta: "Start free",
  },
  {
    name: "Pro",
    price: "$25",
    note: "per month",
    blurb: "For builders shipping real apps.",
    features: ["500 AI builds / month", "Unlimited projects", "GitHub push & import", "Custom domains", "API & CLI access"],
    cta: "Start 14-day trial",
    featured: true,
  },
  {
    name: "Team",
    price: "$40",
    note: "per seat / month",
    blurb: "Business and engineering, one workspace.",
    features: ["Shared projects & roles", "Guided ↔ Pro handoff reviews", "Agent evals & traces", "SSO (Google)", "Priority support"],
    cta: "Start team trial",
  },
  {
    name: "Enterprise",
    price: "Custom",
    note: "annual",
    blurb: "Lyzr's responsible-AI stack, your cloud.",
    features: ["VPC / on-prem deploy", "Audit log & SOC 2", "PII redaction guardrails", "Dedicated solutions architect", "SLA"],
    cta: "Talk to us",
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="annotation">Pricing</p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">Start free. Pay when it&apos;s real.</h1>
        <p className="mt-4 text-ink-2">Every plan includes both lenses and every agent framework. Billing here is a mock for the prototype.</p>
      </div>
      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={cn(
              "flex flex-col rounded-2xl border bg-elev p-6",
              p.featured ? "border-accent shadow-card ring-4 ring-accent/10" : "border-line",
            )}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{p.name}</h2>
              {p.featured && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">Most popular</span>}
            </div>
            <p className="mt-4">
              <span className="font-display text-4xl">{p.price}</span> <span className="text-[13px] text-ink-3">{p.note}</span>
            </p>
            <p className="mt-2 text-[14px] text-ink-2">{p.blurb}</p>
            <ul className="mt-6 flex-1 space-y-2.5 text-[14px]">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-none text-ok" aria-hidden /> {f}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className={cn(
                "mt-8 inline-flex h-10 items-center justify-center rounded-lg text-sm font-medium",
                p.featured ? "bg-accent text-accent-ink hover:brightness-110" : "border border-line hover:bg-sunken",
              )}
            >
              {p.cta}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
