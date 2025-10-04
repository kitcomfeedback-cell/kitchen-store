import { Metadata } from "next";

// ✅ SEO Metadata for Homepage
export const metadata: Metadata = {
  title: "Premium Kitchen Store | Modern Cookware, Utensils & Accessories",
  description:
    "Shop the best kitchen essentials, cookware, utensils, organizers, and appliances. Premium quality, affordable prices, and 50% more value.",
  keywords: [
    "kitchen store",
    "cookware",
    "utensils",
    "kitchen accessories",
    "kitchen organizers",
    "kitchen appliances",
    "cutlery",
    "bakeware",
    "cleaning accessories",
  ],
  authors: [{ name: "Your Brand Name" }],
  openGraph: {
    title: "Premium Kitchen Store | Modern Cookware, Utensils & Accessories",
    description:
      "Upgrade your kitchen with premium essentials — cookware, utensils, organizers, bottles & more.",
    url: "https://yourdomain.com", // ✅ Replace with your real domain
    siteName: "Premium Kitchen Store",
    images: [
      {
        url: "https://yourdomain.com/og-image.jpg", // ✅ Replace with real OG image path
        width: 1200,
        height: 630,
        alt: "Kitchen Store - Cookware & Utensils",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@yourtwitterhandle", // optional
    title: "Premium Kitchen Store",
    description:
      "Shop premium kitchen accessories, utensils, and cookware. Affordable prices, elegant designs.",
    images: ["https://yourdomain.com/og-image.jpg"], // ✅ Replace with your image
  },
  icons: {
    icon: "/favicon.ico", // ✅ Make sure you have this in your /public
  },
};
