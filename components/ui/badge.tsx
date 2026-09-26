import type { ReactNode } from "react";

export default function Badge({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-bold">{children}</span>;
}
