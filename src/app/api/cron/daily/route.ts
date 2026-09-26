import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runDailyJobs } from "@/lib/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Tâches quotidiennes (Vercel Cron) : protégées par CRON_SECRET (en-tête Authorization: Bearer). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new NextResponse("Non autorisé", { status: 401 });
  }
  return NextResponse.json({ ok: true, results: await runDailyJobs() });
}
