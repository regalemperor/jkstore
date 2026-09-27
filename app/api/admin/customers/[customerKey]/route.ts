import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/admin";
import { getAdminCustomer } from "@/lib/admin/customers";

function isCustomerKey(value: string) {
  return /^[a-f0-9]{32}$/i.test(value);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ customerKey: string }> },
) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const { customerKey } = await params;

  if (!isCustomerKey(customerKey)) {
    return NextResponse.json(
      { error: "Customer not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await getAdminCustomer(customerKey);

    if (!result) {
      return NextResponse.json(
        { error: "Customer not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Admin customer detail failed:", error);
    return NextResponse.json(
      { error: "Unable to load customer." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
