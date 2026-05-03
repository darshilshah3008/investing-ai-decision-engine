import type { Metadata } from "next";
import { AuthProvider } from "@/lib/firebase/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Investing AI Decision Engine | Institutional Research",
  description:
    "See the math behind every stock decision. We read every 10-K and 10-Q a company has filed with the SEC, run fundamental models, and show the formula behind every Buy / Hold / Sell.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-on-background font-body-md selection:bg-primary-container selection:text-on-primary-container">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
