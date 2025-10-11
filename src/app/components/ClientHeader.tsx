"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ShoppingBag, UserRound, UtensilsCrossed } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ClientHeader() {

  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();

  // ✅ Prevent hydration mismatch
  useEffect(() => setIsMounted(true), []);

  // 🛒 Update cart count
  const updateCartCount = () => {
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    const total = cart.reduce((sum: number, item: any) => sum + item.qty, 0);
    setCartCount(total);
  };

  useEffect(() => {
    if (!isMounted) return;
    updateCartCount();
    const onStorage = (e: StorageEvent) => e.key === "cart" && updateCartCount();
    const onCustomUpdate = () => updateCartCount();
    window.addEventListener("storage", onStorage);
    window.addEventListener("cartUpdated", onCustomUpdate);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("cartUpdated", onCustomUpdate);
    };
  }, [isMounted]);

  // 🚀 Global navigation handler
  useEffect(() => {
    if (!isMounted) return;

    const triggerLoader = () => {
      setIsNavigating(true);
      setTimeout(() => setIsNavigating(false), 600); // short, visible feedback
    };

    const handleClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest("a");
      if (link && link.href.startsWith(window.location.origin)) triggerLoader();
    };

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [isMounted]);

  if (!isMounted) return null;
  // ✅ Dynamic class for border
  const headerClass = `
    sticky top-0 z-50 bg-white/80 backdrop-blur-md shadow-sm
    ${pathname === "/" ? "pb-16 border-0" : "pb-0 border-b border-gray-100"}
  `;

  if (!isMounted) return null;

  return (
    <>
      {/* 🌀 Fullscreen blur + circular loader */}
      <AnimatePresence>
        {isNavigating && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed inset-0 z-[60] backdrop-blur-sm bg-white/40 flex items-center justify-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
              className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔝 Header */}
      <header className={headerClass}>
        {/* 🌈 Top bar loader */}
        <AnimatePresence>
          {isNavigating && (
            <motion.div
              key="nav-loader"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="absolute top-0 left-0 h-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 origin-left"
            />
          )}
        </AnimatePresence>

        {/* 🧭 Layout */}
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          {/* Logo */}
            <motion.div whileTap={{ scale: 0.95 }}>
              <Link href="/" className="flex items-center gap-2 group">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 12 }}
                  className="p-1.5 rounded-xl border-2 border-blue-300 bg-transparent flex items-center justify-center"
                >
                  <img
                    src="/logo.png"
                    alt="Kitchenary Logo"
                    className="w-10 h-8 sm:w-20 sm:h-12 object-contain"
                  />
                  
                  <span className="text-base sm:text-lg font-bold tracking-tight text-blue-400">
                   &nbsp; Kitchenary &nbsp;
                </span>
                </motion.div>
                
              </Link>
            </motion.div>

          {/* Icons */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Cart */}
            <motion.div whileTap={{ scale: 0.9 }}>
              <Link
                href="/cart"
                className="relative flex items-center justify-center p-1.5 sm:p-2 rounded-full bg-blue-50 hover:bg-blue-100 transition"
              >
                <ShoppingBag
                  size={25}
                  className="text-blue-600 hover:scale-110 transition-transform"
                />
                <AnimatePresence>
                  {cartCount > 0 && (
                    <motion.span
                      key={cartCount}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 20,
                      }}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] w-4.5 h-4.5 flex items-center justify-center rounded-full"
                    >
                      {cartCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            </motion.div>

            {/* Profile */}
            <motion.div whileTap={{ scale: 0.9 }}>
              <Link
                href="/profile"
                className="flex items-center justify-center p-1.5 sm:p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition"
              >
                <UserRound
                  size={25}
                  className="text-red-700 hover:text-blue-600 transition"
                />
              </Link>
            </motion.div>
          </div>
        </div>
      </header>
    </>
  );
}
