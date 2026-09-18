import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JKSTORE",
  description: "A modern ecommerce experience built for JKSTORE.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
