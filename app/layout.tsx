import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JKSTORE | Everyday pieces. Made to stand out.",
  description: "Discover carefully selected essentials and statement pieces at JKSTORE.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
