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
  metadataBase: new URL("https://leads.abdelhadygabriel.me"),
  alternates: { canonical: "/" },
  openGraph: {
    title: "Lead Profiler — Cold-outreach research compression",
    description: "5-step pipeline that turns 5 minutes of social-media observation into a pitch-ready WhatsApp opener.",
    url: "https://leads.abdelhadygabriel.me",
    siteName: "Lead Profiler",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Lead Profiler — Cold-outreach research compression" }],
  },
  title: "Lead Profiler — Cold-outreach research compression",
  description:
    "5-step pipeline that turns 5 minutes of social-media observation into a pitch-ready WhatsApp opener. DiSC, SPIN, Cialdini and Gulf-market playbooks.",
  keywords: ["sales", "lead profiling", "DISC", "SPIN selling", "Cialdini", "Gulf market", "WhatsApp outreach"],
  authors: [{ name: "Lead Profiler" }],
  icons: {
    icon: "/favicon.ico",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lead Profiler — Cold-outreach research compression",
    description: "5 minutes of observation → a pitch-ready WhatsApp opener. DiSC, SPIN, Cialdini playbooks.",
    images: ["/og.png"],
  },
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
