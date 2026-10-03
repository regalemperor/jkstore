import "server-only";

type PaystackVerification = {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  transactionId: string;
  metadata: unknown;
  raw: unknown;
};

export async function verifyPaystackTransaction(reference: string): Promise<PaystackVerification> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Payment service is not configured.");
  }

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
      cache: "no-store",
    },
  );

  const payload = await response.json();

  if (!response.ok || !payload?.status || !payload?.data) {
    throw new Error(payload?.message || "Unable to verify payment.");
  }

  const data = payload.data;

  if (
    typeof data.reference !== "string" ||
    !Number.isSafeInteger(data.amount) ||
    typeof data.currency !== "string" ||
    typeof data.status !== "string" ||
    !Number.isSafeInteger(data.id)
  ) {
    throw new Error("Paystack returned an invalid verification response.");
  }

  return {
    status: data.status,
    reference: data.reference,
    amount: data.amount,
    currency: data.currency,
    transactionId: String(data.id),
    metadata: data.metadata ?? {},
    raw: data,
  };
}
