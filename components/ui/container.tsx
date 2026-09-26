import type { ReactNode } from "react";

export default function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={"mx-auto w-full max-w-7xl px-5 lg:px-8 " + className}>{children}</div>;
}
