import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Studio",
  description: "Multi-agent orchestration workspace",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
