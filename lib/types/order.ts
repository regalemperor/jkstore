export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type PaymentStatus =
  | "pending"
  | "success"
  | "failed"
  | "reversed"
  | "refunded";

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string;
  unitPriceKobo: number;
  quantity: number;
  lineTotalKobo: number;
};

export type Order = {
  id: string;
  userId: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  currency: "NGN";
  subtotalKobo: number;
  shippingKobo: number;
  discountKobo: number;
  totalKobo: number;
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  shippingAddress?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
  paymentReference?: string | null;
  guestAccessExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentTransaction = {
  id: string;
  orderId: string;
  provider: "paystack";
  providerReference: string;
  providerTransactionId?: string | null;
  amountKobo: number;
  orderAmountKobo?: number;
  expectedCustomerChargeKobo?: number;
  feeMode?: "absorb" | "pass_to_customer";
  providerFeeKobo?: number | null;
  currency: "NGN";
  status: PaymentStatus;
  verifiedAt?: string | null;
  verificationMetadata?: Record<string, unknown> | null;
  webhookEventKey?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderEvent = {
  id: string;
  orderId: string;
  eventType: string;
  actorType: "system" | "customer" | "admin";
  actorId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};
