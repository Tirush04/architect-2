import { AppHeader } from "@/components/app-header";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { usageStatus } from "@/lib/rate-limit";
import { prismaUsageStore } from "@/lib/usage";
import { selectEngine } from "@/lib/engine";
import { signOutAction } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [projects, usage] = await Promise.all([
    db.project.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 20, select: { id: true, name: true } }),
    usageStatus(prismaUsageStore, user.id),
  ]);
  const engine = selectEngine({ overLimit: usage.overLimit }).claude ? "claude" : "demo";
  return (
    <>
      <AppHeader
        user={{ name: user.name, email: user.email, image: user.image }}
        projects={projects}
        usage={{ used: usage.used, limit: usage.limit, engine }}
        signOut={signOutAction}
      />
      <main id="main">{children}</main>
    </>
  );
}
