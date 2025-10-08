import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { ShoppingCart, UserRound, UtensilsCrossed } from "lucide-react";
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
    <html lang="en">
      <body
          className={`${inter.className} ${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 text-gray-900`}
          >
        {/* 🌟 Premium Header */}
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100">
          <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-8 py-3">
            {/* 🏪 Logo Section */}
            <Link
              href="/"
              className="flex items-center space-x-2 group transition-all hover:opacity-90"
            >
              <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl shadow-sm group-hover:shadow-md transition">
                <UtensilsCrossed
                  size={22}
                  className="text-blue-600 group-hover:rotate-12 transition-transform"
                />
              </div>
              <span className="text-lg sm:text-xl font-bold tracking-tight">
                Kitchenary
              </span>
            </Link>

            {/* 🔹 Nav Links (Optional - Add More Later) */}
            {/* <nav className="hidden sm:flex space-x-6 text-sm font-medium text-gray-700">
              <Link href="/shop" className="hover:text-blue-600">
                Shop
              </Link>
              <Link href="/offers" className="hover:text-blue-600">
                Offers
              </Link>
              <Link href="/contact" className="hover:text-blue-600">
                Contact
              </Link>
            </nav> */}

            {/* 🛒 Icons Section */}
            <div className="flex items-center space-x-4">
              {/* Cart */}
              <Link
                href="/cart"
                className="relative p-2 rounded-full bg-blue-50 hover:bg-blue-100 transition"
              >
                <ShoppingCart
                  size={20}
                  className="text-blue-600 hover:scale-110 transition-transform"
                />
                {/* 🔴 Cart Badge (Optional) */}
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5">
                  2
                </span>
              </Link>

              {/* Profile */}
              <Link
                href="/profile"
                className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition"
              >
                <UserRound
                  size={20}
                  className="text-gray-700 hover:text-blue-600 transition"
                />
              </Link>
            </div>
          </div>
        </header>

        {/* 🧱 Page Content */}
        <main className="min-h-screen">{children}</main>

        {/* ⚡ Footer (optional premium look) */}
        <footer className="bg-white/70 backdrop-blur-md border-t border-gray-100 py-4 mt-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 text-center text-sm text-gray-500">
            © {new Date().getFullYear()} Kitchenary — All Rights Reserved.
          </div>
        </footer>
      </body>
    </html>
  );
}
