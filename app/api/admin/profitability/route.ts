import { NextResponse } from "next/server";
import { getSafeErrorDetails, logError } from "@/lib/http/logger";
import { getCurrentAdmin } from "@/lib/auth/admin";
import {
  getOwnerProfitability,
  getOwnerProfitabilityTimeline,
  type ProfitabilityPeriod,
} from "@/lib/admin/profitability";

const PERIODS: ProfitabilityPeriod[] = ["24h", "7d", "30d", "1y"];

export async function GET(request: Request) {
  const admin = await getCurrentAdmin();

  if (!admin || admin.role !== "owner") {
    return NextResponse.json(
      { error: "Owner access required." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const period = new URL(request.url).searchParams.get("period") as ProfitabilityPeriod | null;

  if (!period || !PERIODS.includes(period)) {
    return NextResponse.json(
      { error: "Invalid reporting period." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const [report, timeline] = await Promise.all([
      getOwnerProfitability(admin.id, period),
      getOwnerProfitabilityTimeline(admin.id, period),
    ]);

    return NextResponse.json(
      { ...report, timeline },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logError("admin.profitability.unhandled_error", getSafeErrorDetails(error));
    return NextResponse.json(
      { error: "Unable to load profitability report." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
