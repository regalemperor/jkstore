import "server-only";

export type PaystackFeeMode = "absorb" | "pass_to_customer";

const NGN_PERCENT_NUMERATOR = 15n; // 1.5%
const NGN_PERCENT_DENOMINATOR = 1000n;
const NGN_FLAT_FEE_KOBO = 10_000n; // ₦100
const NGN_FLAT_FEE_WAIVER_THRESHOLD_KOBO = 250_000n; // ₦2,500
const NGN_FEE_CAP_KOBO = 200_000n; // ₦2,000

export function getPaystackFeeMode(): PaystackFeeMode {
  return process.env.PAYSTACK_FEE_MODE?.trim() === "pass_to_customer"
    ? "pass_to_customer"
    : "absorb";
}

/**
 * Calculates the expected customer charge when Paystack's dashboard
 * "Pass fees to customers" setting is enabled for Nigerian local payments.
 *
 * Paystack documents a 1.5% + ₦100 fee, capped at ₦2,000, with the ₦100
 * flat fee waived for transactions under ₦2,500. The calculation is done
 * entirely in integer kobo and floors to the nearest kobo, matching the
 * documented gross-up formula without floating-point money arithmetic.
 */
export function calculateExpectedCustomerChargeKobo(orderAmountKobo: bigint): bigint {
  if (orderAmountKobo <= 0n) {
    throw new Error("Order amount must be positive.");
  }

  const flatFee =
    orderAmountKobo < NGN_FLAT_FEE_WAIVER_THRESHOLD_KOBO
      ? 0n
      : NGN_FLAT_FEE_KOBO;

  const applicableFee =
    (orderAmountKobo * NGN_PERCENT_NUMERATOR) / NGN_PERCENT_DENOMINATOR +
    flatFee;

  if (applicableFee >= NGN_FEE_CAP_KOBO) {
    return orderAmountKobo + NGN_FEE_CAP_KOBO;
  }

  // ((price + flat fee) / (1 - 1.5%)) + ₦0.01
  // Represent the denominator as 985/1000 and floor to kobo.
  const numerator =
    (orderAmountKobo + flatFee) * 1000n + 10n * 985n;

  return numerator / 985n;
}
