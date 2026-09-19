import type { ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
};

const variants = {
  primary: "bg-black text-white hover:bg-neutral-800",
  secondary: "border border-neutral-300 bg-white text-black hover:bg-neutral-50",
  ghost: "bg-transparent text-black hover:bg-neutral-100",
};

export default function Button({ children, href, variant = "primary", className = "" }: ButtonProps) {
  const classes = "inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black " + variants[variant] + " " + className;
  if (href) return <a href={href} className={classes}>{children}</a>;
  return <button type="button" className={classes}>{children}</button>;
}
