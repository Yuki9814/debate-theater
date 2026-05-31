import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "论衡剧场",
  description: "中文 AI 辩论工作台。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
