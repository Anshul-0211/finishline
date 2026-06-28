import type { Metadata } from "next";
import { plusJakartaSans, manrope } from "@/lib/fonts";
import { ThemeProvider } from "@/lib/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinishLine",
  description: "Your AI companion for commitments and accountability.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${manrope.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans bg-background text-on-surface">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
