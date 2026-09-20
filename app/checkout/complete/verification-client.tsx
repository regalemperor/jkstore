"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Container from "@/components/ui/container";

type VerificationState = {
  status: "loading" | "paid" | "pending" | "failed";
  orderId?: string;
  paymentStatus?: string;
  message?: string;
};

export default function CheckoutCompleteClient({ reference }: { reference: string | null }) {
  const [state, setState] = useState<VerificationState>({ status: "loading" });

  useEffect(() => {
    if (!reference) {
      setState({ status: "failed", message: "No payment reference was provided." });
      return;
    }

    const paymentReference = reference;
    let cancelled = false;
    let attempts = 0;

    async function verify() {
      attempts += 1;

      try {
        const response = await fetch(
          `/api/paystack/verify?reference=${encodeURIComponent(paymentReference)}`,
          { cache: "no-store" },
        );
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setState({ status: "failed", message: data.error || "We could not verify the payment." });
          return;
        }

        if (data.status === "paid" && data.paymentStatus === "success") {
          setState({
            status: "paid",
            orderId: data.orderId,
            paymentStatus: data.paymentStatus,
          });
          return;
        }

        if (["failed", "reversed", "refunded"].includes(data.paymentStatus)) {
          setState({
            status: "failed",
            orderId: data.orderId,
            paymentStatus: data.paymentStatus,
            message: "The payment was not completed.",
          });
          return;
        }

        setState({
          status: "pending",
          orderId: data.orderId,
          paymentStatus: data.paymentStatus,
          message: attempts < 5
            ? "Payment is still being confirmed securely."
            : "Payment is still processing. You can check your order again shortly.",
        });

        if (attempts < 5) {
          window.setTimeout(verify, 3000);
        }
      } catch {
        if (!cancelled) {
          setState({ status: "failed", message: "Unable to reach the payment verification service." });
        }
      }
    }

    void verify();

    return () => {
      cancelled = true;
    };
  }, [reference]);

  return (
    <main className="min-h-screen bg-white text-neutral-950">
      <header className="border-b border-black/10">
        <Container className="flex items-center justify-between py-5">
          <Link href="/" className="text-xl font-black tracking-[-0.05em]">JKSTORE</Link>
          <Link href="/cart" className="text-sm font-semibold underline underline-offset-4">Back to bag</Link>
        </Container>
      </header>

      <section className="py-20">
        <Container className="max-w-2xl">
          {state.status === "loading" ? (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-black/50">Payment</p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">Verifying your payment…</h1>
              <p className="mt-4 text-black/60">Please keep this page open while JKSTORE confirms the transaction with Paystack.</p>
            </>
          ) : state.status === "paid" ? (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-black/50">Payment confirmed</p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">Order secured.</h1>
              <p className="mt-4 text-black/60">Your payment was verified server-side. Your order can now move into fulfillment.</p>
              {state.orderId ? <p className="mt-4 text-sm text-black/50">Order ID: {state.orderId}</p> : null}
              <Link href="/" className="mt-8 inline-flex min-h-11 items-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white">Continue shopping</Link>
            </>
          ) : state.status === "pending" ? (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-black/50">Payment processing</p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">We’re confirming it.</h1>
              <p className="mt-4 text-black/60">{state.message}</p>
              {state.orderId ? <p className="mt-4 text-sm text-black/50">Order ID: {state.orderId}</p> : null}
              <Link href="/" className="mt-8 inline-flex min-h-11 items-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white">Continue shopping</Link>
            </>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-black/50">Payment not confirmed</p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">We couldn’t confirm payment.</h1>
              <p className="mt-4 text-black/60">{state.message}</p>
              {state.orderId ? <p className="mt-4 text-sm text-black/50">Order ID: {state.orderId}</p> : null}
              <Link href="/" className="mt-8 inline-flex min-h-11 items-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white">Return to store</Link>
            </>
          )}
        </Container>
      </section>
    </main>
  );
}
