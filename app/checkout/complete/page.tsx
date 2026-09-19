import CheckoutCompleteClient from "./verification-client";

export default async function CheckoutCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string | string[] }>;
}) {
  const params = await searchParams;
  const value = params.reference;
  const reference = Array.isArray(value) ? value[0] ?? null : value ?? null;

  return <CheckoutCompleteClient reference={reference} />;
}
