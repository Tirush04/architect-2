"use client";

import { useState } from "react";
import { Copy, ExternalLink, GitBranch, Rocket } from "lucide-react";
import { toast } from "sonner";
import { Button, Input } from "@/components/ui";
import { Dialog } from "@/components/dialog";
import { oauthAction } from "@/app/(auth)/actions";
import type { WorkspaceApi } from "./types";

export function ShareDialog({ open, onClose, api }: { open: boolean; onClose: () => void; api: WorkspaceApi }) {
  const url = api.data.deployments[0]?.url;
  const [email, setEmail] = useState("");
  return (
    <Dialog open={open} onClose={onClose} title="Share" description={url ? "Anyone with the link can use the live app." : "Deploy to get a public link."}>
      {url ? (
        <div className="space-y-5">
          <div className="flex gap-2">
            <Input readOnly value={url} aria-label="Public link" onFocus={(e) => e.currentTarget.select()} className="font-mono text-[12.5px]" />
            <Button variant="secondary" onClick={() => void navigator.clipboard.writeText(url).then(() => toast.success("Link copied"))} aria-label="Copy link">
              <Copy className="h-4 w-4" />
            </Button>
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-line hover:bg-sunken" aria-label="Open live app">
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error("Enter a valid email");
              toast.success(`Invite to edit sent to ${email} (simulated)`);
              setEmail("");
            }}
          >
            <p className="mb-1.5 text-[13px] font-medium">Invite a collaborator to the project</p>
            <div className="flex gap-2">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" type="email" aria-label="Collaborator email" />
              <Button type="submit" variant="secondary">
                Invite
              </Button>
            </div>
            <p className="mt-1.5 text-[12px] text-ink-3">They can open it in the Guided or Pro lens.</p>
          </form>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Later
          </Button>
          <Button
            onClick={() => {
              onClose();
              api.setTab("deploy");
            }}
            disabled={api.data.version === 0}
          >
            <Rocket className="h-4 w-4" /> Go to Deploy
          </Button>
        </div>
      )}
    </Dialog>
  );
}

export function GitHubDialog({ open, onClose, api }: { open: boolean; onClose: () => void; api: WorkspaceApi }) {
  const { github, project, version } = api.data;
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<{ url: string; fullName: string } | null>(null);

  const push = async () => {
    setPushing(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/github`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Push failed");
      setResult(j);
      toast.success(`Pushed to ${j.fullName}`);
      await api.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPushing(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="GitHub" description="Own your code. Every push is a normal commit you can clone, review and extend.">
      {!github.configured ? (
        <p className="rounded-lg bg-sunken p-3 text-[13px] text-ink-2">
          GitHub sign-in isn&apos;t configured on this deployment. Set <code className="font-mono">AUTH_GITHUB_ID</code> and <code className="font-mono">AUTH_GITHUB_SECRET</code> to enable
          pushing and importing.
        </p>
      ) : !github.connected ? (
        <form action={oauthAction} className="space-y-3">
          <input type="hidden" name="provider" value="github" />
          <input type="hidden" name="callbackUrl" value={`/p/${project.id}`} />
          <p className="text-[13px] text-ink-2">Connect your GitHub account to create a repository and push this project. Architect only asks for public repo access.</p>
          <Button type="submit" className="w-full">
            <GitBranch className="h-4 w-4" /> Connect GitHub
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          {project.githubRepo && (
            <a href={`https://github.com/${project.githubRepo}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-line p-3 text-sm hover:bg-sunken">
              <GitBranch className="h-4 w-4" /> {project.githubRepo} <ExternalLink className="ml-auto h-3.5 w-3.5" />
            </a>
          )}
          {result && (
            <p className="rounded-lg bg-ok-soft p-3 text-[13px] text-ok">
              Pushed v{version} ·{" "}
              <a href={result.url} target="_blank" rel="noreferrer" className="underline">
                open repository
              </a>
            </p>
          )}
          <Button className="w-full" onClick={() => void push()} loading={pushing} disabled={version === 0}>
            <GitBranch className="h-4 w-4" /> {project.githubRepo ? `Push v${version}` : `Create repo & push v${version}`}
          </Button>
        </div>
      )}
    </Dialog>
  );
}
