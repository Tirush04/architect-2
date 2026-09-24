export const DAY_MS = 24 * 60 * 60 * 1000;

export function dailyLimit(): number {
  const n = Number(process.env.ARCHITECT_DAILY_LIMIT ?? 25);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 25;
}

export type UsageStore = {
  countSince(userId: string, kind: string, since: Date): Promise<number>;
  record(userId: string, kind: string): Promise<void>;
};

export type UsageStatus = { used: number; limit: number; remaining: number; overLimit: boolean };

export async function usageStatus(
  store: UsageStore,
  userId: string,
  kind = "ai",
  now: Date = new Date(),
  limit = dailyLimit(),
): Promise<UsageStatus> {
  const used = await store.countSince(userId, kind, new Date(now.getTime() - DAY_MS));
  return { used, limit, remaining: Math.max(0, limit - used), overLimit: used >= limit };
}
