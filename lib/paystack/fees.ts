import "server-only";

export type PaystackFeeMode = "absorb" | "pass_to_customer";

const NGN_PERCENT_NUMERATOR = BigInt("15"); // 1.5%
const NGN_PERCENT_DENOMINATOR = BigInt("1000");
const NGN_FLAT_FEE_KOBO = BigInt("10000"); // ₦100
const NGN_FLAT_FEE_WAIVER_THRESHOLD_KOBO = BigInt("250000"); // ₦2,500
const NGN_FEE_CAP_KOBO = BigInt("200000"); // ₦2,000

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
  if (orderAmountKobo <= BigInt("0")) {
    throw new Error("Order amount must be positive.");
  }

  const flatFee =
    orderAmountKobo < NGN_FLAT_FEE_WAIVER_THRESHOLD_KOBO
      ? BigInt("0")
      : NGN_FLAT_FEE_KOBO;

  const applicableFee =
    (orderAmountKobo * NGN_PERCENT_NUMERATOR) / NGN_PERCENT_DENOMINATOR +
    flatFee;

  if (applicableFee >= NGN_FEE_CAP_KOBO) {
    return orderAmountKobo + NGN_FEE_CAP_KOBO;
  }

  // ((price + flat fee) / (1 - 1.5%)) + ₦0.01
  // Represent the denominator as 985/1000 and floor to kobo.
  const grossUpKobo =
    ((orderAmountKobo + flatFee) * BigInt("1000")) / BigInt("985");

  return grossUpKobo + BigInt("1");
}
