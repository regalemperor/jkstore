import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

function getClientIdentity(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedIp = forwardedFor?.split(",")[0]?.trim();

  return (
    forwardedIp ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function hashKey(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export async function consumeApiRateLimit(
  request: Request,
  scope: string,
  windowSeconds: number,
  maxRequests: number,
): Promise<RateLimitResult> {
  const identity = getClientIdentity(request);
  const keyHash = hashKey(identity);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("consume_api_rate_limit", {
    p_scope: scope,
    p_key_hash: keyHash,
    p_window_seconds: windowSeconds,
    p_max_requests: maxRequests,
  });

  if (error || !data?.[0]) {
    console.error("API rate-limit check failed:", error?.message ?? "No result");
    // Fail open so a rate-limit infrastructure problem cannot take checkout
    // or payment processing offline. The endpoint's existing validation,
    // authorization, idempotency, and payment controls remain authoritative.
    return {
      allowed: true,
      remaining: maxRequests,
      retryAfterSeconds: windowSeconds,
    };
  }

  return {
    allowed: Boolean(data[0].allowed),
    remaining: Number(data[0].remaining),
    retryAfterSeconds: Number(data[0].retry_after_seconds),
  };
}
