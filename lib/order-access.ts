import { createHash } from "node:crypto";
import { cookies } from "next/headers";

export async function getGuestOrderAccessHash() {
  const token = (await cookies()).get("__Host-jkstore-order-access")?.value;

  if (!token || token.length < 40) {
    return null;
  }

  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isValidOrderUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
