import { db } from "@/lib/db";
import type { UsageStore } from "@/lib/rate-limit";

export const prismaUsageStore: UsageStore = {
  countSince: (userId, kind, since) =>
    db.usageEvent.count({ where: { userId, kind, createdAt: { gte: since } } }),
  record: async (userId, kind) => {
    await db.usageEvent.create({ data: { userId, kind } });
  },
};
