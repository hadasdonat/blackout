import { HttpError } from "@/lib/server/http";

export type LevelParams = { params: Promise<{ n: string }> };
export async function levelNumber(ctx: LevelParams) {
  const n = Number((await ctx.params).n);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(404, "אין שלב כזה");
  return n;
}
