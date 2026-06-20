import "./globals.css";
import type { Metadata } from "next";
// Adjust this import path if you saved the theme-provider.tsx somewhere else!
import { ThemeProvider } from "../components/theme-provider";

export const metadata: Metadata = {
  title: "StockEasy | Modern Pharmacy Management",
  description: "AI-powered inventory, FEFO tracking, and POS for modern pharmacies.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased min-h-screen">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}