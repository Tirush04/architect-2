import Link from "next/link";
import { auth } from "@/auth";
import { Logo } from "@/components/logo";
import { MarketingNav } from "@/components/marketing";
import { ThemeToggle } from "@/components/theme";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-1">
            <MarketingNav signedIn={!!session?.user} />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-[13px] text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <p>Architect 2.0 · a concept build for the Lyzr Architect assignment.</p>
          <div className="flex gap-4">
            <Link href="/pricing" className="hover:text-ink">Pricing</Link>
            <Link href="/login" className="hover:text-ink">Sign in</Link>
            <Link href="/signup" className="hover:text-ink">Start free</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
