import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lead Profiler — Cold-outreach research compression",
  description:
    "5-step pipeline that turns 5 minutes of social-media observation into a pitch-ready WhatsApp opener. Culture Map → DiSC → Status Anxiety ∥ Laws of Human Nature → Influence → SPIN.",
  keywords: ["sales", "lead profiling", "DISC", "SPIN selling", "Cialdini", "Gulf market", "WhatsApp outreach"],
  authors: [{ name: "Lead Profiler" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <SonnerToaster position="top-right" richColors />
      </body>
    </html>
  );
}
