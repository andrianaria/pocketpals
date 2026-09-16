import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pocketpals — Personal Finance Tracker",
  description: "A kawaii personal finance tracker for your everyday money days.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
