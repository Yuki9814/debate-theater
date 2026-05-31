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
  const themeScript = `
    (function () {
      try {
        var theme = localStorage.getItem("lunheng-theme") || "dark";
        document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
        document.documentElement.style.colorScheme = document.documentElement.dataset.theme;
      } catch (error) {
        document.documentElement.dataset.theme = "dark";
        document.documentElement.style.colorScheme = "dark";
      }
    })();
  `;

  return (
    <html lang="zh-CN" className="h-full antialiased" data-theme="dark" suppressHydrationWarning>
      <body className="min-h-full">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
