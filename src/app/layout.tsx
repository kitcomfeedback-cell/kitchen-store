// src/app/layout.tsx

import type { Metadata } from "next";
import ClientHeader from "@/app/components/ClientHeader";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kitchenary - Premium Kitchen Store",
  description:
    "Shop modern cookware, utensils & kitchen essentials. Premium quality, elegant design & affordable prices.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  
  
  return (
    <html lang="en" data-scroll-behavior="smooth" className="will-change-transform">

      <body
          className={`${inter.className} ${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 text-gray-900`}
          >
        {/* 🌟 Premium Header */}
        <ClientHeader />

        {/* 🧱 Page Content */}
        <main className="min-h-screen">{children}</main>

        {/* ⚡ Footer (optional premium look) */}
        <footer className="bg-white/70 backdrop-blur-md border-t border-gray-100 py-4 mt-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 text-center text-sm text-gray-500">
            © {new Date().getFullYear()} Kitchenary — All Rights Reserved. &nbsp;
                          <a href="/privacy-terms" className="text-sm text-blue-600 underline hover:text-blue-900">
                 Privacy & Terms
              </a>
          </div>
        </footer>
      </body>
    </html>
  );
}