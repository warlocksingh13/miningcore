import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navigation from "./components/layout/Navigation";
import Footer from "./components/layout/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Miningcore WebUI 2",
    template: "%s · Miningcore WebUI 2",
  },
  description: "Modern Miningcore dashboard with real-time pool, miner, and network analytics.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-slate-950">
      <body className={`${geistSans.variable} ${geistMono.variable} bg-slate-950 text-slate-100 antialiased`}>
        <div className="flex min-h-screen flex-col">
          <Navigation />
          <main className="flex-1 bg-slate-950">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
