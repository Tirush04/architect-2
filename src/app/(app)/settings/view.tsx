"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Terminal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Input, Label } from "@/components/ui";
import { Dialog } from "@/components/dialog";
import { oauthAction } from "@/app/(auth)/actions";
import { deleteAccount, setDefaultLens } from "../actions";
import { createApiKey, revokeApiKey, updateProfile } from "./actions";
import { cn, timeAgo } from "@/lib/utils";

type Props = {
  origin: string;
  user: { name: string; email: string; lens: "GUIDED" | "PRO"; hasPassword: boolean };
  linked: { github: boolean; google: boolean };
  configured: { github: boolean; google: boolean };
  keys: Array<{ id: string; name: string; prefix: string; createdAt: string; lastUsed: string | null }>;
  usage: { used: number; limit: number; remaining: number; engine: string; projects: number; deployments: number };
};

const NAV = [
  ["profile", "Profile"],
  ["connections", "Connected accounts"],
  ["developer", "Developer"],
  ["usage", "Usage & billing"],
  ["danger", "Danger zone"],
];

function Card({ id, title, children, className }: { id: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-20 rounded-xl border border-line bg-elev p-6", className)}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SettingsView({ origin, user, linked, configured, keys, usage }: Props) {
  const [pending, start] = useTransition();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [lens, setLens] = useState(user.lens);
  const pct = usage.limit ? Math.min(100, (usage.used / usage.limit) * 100) : 0;

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[200px_1fr]">
      <nav aria-label="Settings sections" className="lg:sticky lg:top-20 lg:self-start">
        <p className="annotation mb-3">Settings</p>
        <ul className="flex gap-1 overflow-x-auto lg:flex-col">
          {NAV.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="block whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-ink-2 hover:bg-sunken hover:text-ink">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="space-y-6">
        <Card id="profile" title="Profile">
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = String(new FormData(e.currentTarget).get("name") ?? "");
              start(async () => {
                await updateProfile(name);
                toast.success("Profile saved");
              });
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="s-name">Name</Label>
              <Input id="s-name" name="name" defaultValue={user.name} maxLength={80} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="s-email">Email</Label>
              <Input id="s-email" value={user.email} readOnly disabled />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" loading={pending} variant="secondary">
                Save profile
              </Button>
            </div>
          </form>
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-sm font-medium">Default lens for new projects</p>
            <div className="mt-2 flex rounded-lg border border-line bg-sunken p-0.5 sm:w-fit" role="radiogroup" aria-label="Default lens">
              {(["GUIDED", "PRO"] as const).map((l) => (
                <button
                  key={l}
                  role="radio"
                  aria-checked={lens === l}
                  onClick={() => {
                    setLens(l);
                    start(async () => {
                      await setDefaultLens(l);
                      toast.success(`New projects open in the ${l === "GUIDED" ? "Guided" : "Pro"} lens`);
                    });
                  }}
                  className={cn("rounded-md px-4 py-1.5 text-sm", lens === l ? "bg-elev font-medium shadow-sm" : "text-ink-3")}
                >
                  {l === "GUIDED" ? "Guided" : "Pro"}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card id="connections" title="Connected accounts">
          <ul className="divide-y divide-line rounded-lg border border-line">
            {(
              [
                ["google", "Google", "Sign in with Google"],
                ["github", "GitHub", "Sign in, import repos and push code"],
              ] as const
            ).map(([id, name, desc]) => (
              <li key={id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{name}</p>
                  <p className="text-[12px] text-ink-3">{desc}</p>
                </div>
                {linked[id] ? (
                  <Badge tone="ok">
                    <Check className="h-3 w-3" /> Connected
                  </Badge>
                ) : configured[id] ? (
                  <form action={oauthAction}>
                    <input type="hidden" name="provider" value={id} />
                    <input type="hidden" name="callbackUrl" value="/settings#connections" />
                    <Button size="sm" variant="secondary" type="submit">
                      Connect
                    </Button>
                  </form>
                ) : (
                  <Badge tone="neutral">Not configured</Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card id="developer" title="Developer">
          <p className="text-sm text-ink-2">Use API keys to drive Architect from scripts, CI, or coding agents like Claude Code and Cursor.</p>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await createApiKey(keyName);
                if (r.error) return void toast.error(r.error);
                setNewKey(r.key ?? null);
                setKeyName("");
              });
            }}
          >
            <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="Key name, e.g. CI" aria-label="API key name" maxLength={40} />
            <Button type="submit" loading={pending} disabled={!keyName.trim()}>
              <KeyRound className="h-4 w-4" /> Create key
            </Button>
          </form>
          {newKey && (
            <div className="mt-3 rounded-lg border border-ok/40 bg-ok-soft p-3" role="status">
              <p className="text-[13px] font-medium text-ok">Copy this key now. You won&apos;t see it again.</p>
              <div className="mt-2 flex gap-2">
                <Input readOnly value={newKey} className="font-mono text-[12.5px]" aria-label="New API key" onFocus={(e) => e.currentTarget.select()} />
                <Button variant="secondary" aria-label="Copy key" onClick={() => void navigator.clipboard.writeText(newKey).then(() => toast.success("Copied"))}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
            {keys.length === 0 && <li className="px-4 py-3 text-[13px] text-ink-3">No API keys yet.</li>}
            {keys.map((k) => (
              <li key={k.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1">
                  <p className="text-sm font-medium">{k.name}</p>
                  <p className="font-mono text-[12px] text-ink-3">
                    {k.prefix}… · created {timeAgo(k.createdAt)} · {k.lastUsed ? `used ${timeAgo(k.lastUsed)}` : "never used"}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => start(async () => { await revokeApiKey(k.id); toast.success("Key revoked"); })} aria-label={`Revoke ${k.name}`}>
                  <Trash2 className="h-3.5 w-3.5" /> Revoke
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium">
                <Terminal className="h-3.5 w-3.5" /> REST API (live)
              </p>
              <pre className="overflow-x-auto rounded-lg bg-[#0e1015] p-3 font-mono text-[11.5px] leading-relaxed text-[#b1b6c1]">{`curl ${origin}/api/v1/projects \\
  -H "Authorization: Bearer $ARCHITECT_KEY"`}</pre>
            </div>
            <div>
              <p className="mb-1.5 text-[13px] font-medium">MCP server for coding agents (designed)</p>
              <pre className="overflow-x-auto rounded-lg bg-[#0e1015] p-3 font-mono text-[11.5px] leading-relaxed text-[#b1b6c1]">{`claude mcp add architect \\
  -- npx @architect/mcp --key $ARCHITECT_KEY`}</pre>
            </div>
          </div>
        </Card>

        <Card id="usage" title="Usage & billing">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-line p-4">
              <p className="text-[12px] text-ink-3">AI builds today</p>
              <p className="mt-1 text-2xl font-semibold">
                {usage.used}
                <span className="text-base font-normal text-ink-3"> / {usage.limit}</span>
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-sunken" role="progressbar" aria-valuenow={usage.used} aria-valuemin={0} aria-valuemax={usage.limit}>
                <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-ink-3">{usage.engine === "claude" ? "Resets on a rolling 24h window" : "Demo engine active: unlimited"}</p>
            </div>
            <div className="rounded-lg border border-line p-4">
              <p className="text-[12px] text-ink-3">Projects</p>
              <p className="mt-1 text-2xl font-semibold">{usage.projects}</p>
            </div>
            <div className="rounded-lg border border-line p-4">
              <p className="text-[12px] text-ink-3">Deployments</p>
              <p className="mt-1 text-2xl font-semibold">{usage.deployments}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg bg-sunken p-4">
            <div className="flex-1">
              <p className="text-sm font-medium">Free plan</p>
              <p className="text-[12px] text-ink-3">Billing is mocked in this prototype.</p>
            </div>
            <Link href="/pricing" className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink hover:brightness-110">
              Compare plans
            </Link>
          </div>
        </Card>

        <Card id="danger" title="Danger zone" className="border-danger/30">
          <div className="flex items-center gap-3">
            <p className="flex-1 text-sm text-ink-2">Delete your account and every project, agent and deployment you own.</p>
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
              Delete account
            </Button>
          </div>
        </Card>
      </div>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete your account?" description={`Type ${user.email} to confirm. This can't be undone.`}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await deleteAccount(confirmEmail);
              if (r?.error) toast.error(r.error);
            });
          }}
        >
          <Input value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} aria-label="Confirm email" autoComplete="off" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={pending} disabled={confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()}>
              Delete account
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
