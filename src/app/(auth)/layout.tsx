import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <main id="main" className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
        <p className="text-[12px] text-ink-3">By continuing you agree to the Terms and Privacy Policy.</p>
      </main>
      <aside className="relative hidden overflow-hidden border-l border-line bg-sunken lg:block" aria-hidden>
        <div className="blueprint-grid absolute inset-0" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <p className="annotation">Sheet 01 · One project, two lenses</p>
          <div className="space-y-6">
            <div className="max-w-md rounded-xl border border-line bg-elev p-5 shadow-card">
              <p className="annotation mb-3">Guided lens</p>
              <p className="text-[15px] leading-relaxed text-ink">
                “When a dispute email arrives, the <span className="font-semibold text-accent">Intake Agent</span> links the transaction
                and drafts a resolution for your review.”
              </p>
            </div>
            <div className="ml-16 max-w-md rounded-xl border border-line bg-[#0e1015] p-5 font-mono text-[12.5px] leading-relaxed text-[#b1b6c1] shadow-card">
              <p className="annotation mb-3 !text-[#7d8391]">Pro lens · agents/intake_agent.py</p>
              <p>
                <span className="text-[#6d8bff]">intake_agent</span> = create_react_agent(
              </p>
              <p className="pl-4">model, tools=[read_inbox, lookup_transaction],</p>
              <p className="pl-4">prompt=INTAKE_INSTRUCTIONS)</p>
            </div>
          </div>
          <p className="font-display text-3xl leading-tight text-ink">
            Describe it <span className="italic text-accent">or</span> code it.
            <br />
            Ship the agents either way.
          </p>
        </div>
      </aside>
    </div>
  );
}
