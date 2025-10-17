// src/app/page.tsx
"use client";

import { metadata } from "./metadata"; 
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { startTransition } from "react";
import {
  ArrowLeft,
  ArrowUp,
  X,
  Search,
  Utensils,
  CookingPot,
  Refrigerator,
  Boxes,
  Brush,
  FlaskConical,
  Soup,
  CupSoda,
  Salad,
  Sandwich,
  GlassWater,
  SoupIcon,
  Truck,
} from "lucide-react";
import Fuse from "fuse.js";
import catalogData from "./data/catalog.json";

interface Product {
  id: string;
  title: string;
  price?: number | null;
  currency?: string | null;
  image?: string | null;
  link: string;
  description?: string;
  brand?: string | null;
}

/* 🔁 Shuffle Array */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function HomePage() {
  /* 🧱 All Products (+50% price) */
  const router = useRouter(); // ✅ Needed for router.push()

  // 🧭 Restore scroll only for the default randomized home (no query/search)
  useEffect(() => {
    const url = new URL(window.location.href);
    const hasQuery = url.searchParams.size > 0;
    if (hasQuery) return; // skip if it's a filtered/search page

    const savedY = sessionStorage.getItem("homeScrollY");

    // 🕓 Wait until all content is painted to avoid restoring too early
    if (savedY) {
      const restore = () => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: Number(savedY), behavior: "auto" });
        });
      };

      // Restore after paint + short delay
      requestAnimationFrame(() => {
        setTimeout(restore, 100);
      });
    }

    // ✅ Handle browser back/forward too
    if (performance?.getEntriesByType) {
      const entries = performance.getEntriesByType("navigation");
      const navType = (entries[0] as PerformanceNavigationTiming)?.type;
      if (navType === "back_forward" && savedY) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: Number(savedY), behavior: "auto" });
        });
      }
    }
  }, []);

  const allProducts: Product[] = useMemo(() => {
    const items: Product[] = [];
    for (const c of catalogData.categories || []) {
      for (const s of c.subcategories || []) {
        for (const p of s.products || []) {
          const price = typeof p.price === "number" ? Math.round(p.price * 1.5) : null;
          items.push({
            ...p,
            price,
            currency: p.currency ?? "PKR",
            image: p.image ?? null,
          });
        }
      }
    }
    return items;
  }, []);

  /* 🌀 Shuffle once per session */
  const [randomizedProducts, setRandomizedProducts] = useState<Product[]>([]);
  useEffect(() => {
    const cached = sessionStorage.getItem("shuffledProducts");
    if (cached) {
      setRandomizedProducts(JSON.parse(cached));
    } else {
      const shuffled = shuffleArray(allProducts);
      sessionStorage.setItem("shuffledProducts", JSON.stringify(shuffled));
      setRandomizedProducts(shuffled);
    }
  }, [allProducts]);

  /* ♻️ Restore scroll + search after products ready */
  useEffect(() => {
    if (randomizedProducts.length === 0) return; // ⏳ Wait until loaded
    setIsLoading(true);

    const lastQuery = sessionStorage.getItem("lastQuery");
    const prefix = lastQuery ? "search" : "home";
    const savedY = sessionStorage.getItem(`${prefix}ScrollY`);
    const savedVisible = sessionStorage.getItem(`${prefix}Visible`);

    if (savedY) restoreScrollY.current = Number(savedY);
    if (savedVisible) restoreVisible.current = Number(savedVisible);

    // 🧭 Only restore search once products are loaded
    if (lastQuery) {
      const url = new URL(window.location.href);
      const subcatParam = url.searchParams.get("subcategory");
      const searchParam = url.searchParams.get("search");
      const priceParam = url.searchParams.get("price");

      if (subcatParam) {
        filterByCategory(subcatParam);
      } else if (searchParam) {
        performSearch(searchParam);
      } else if (priceParam) {
        const saved = sessionStorage.getItem("activePriceFilter");
        if (saved) {
          const { min, max, label } = JSON.parse(saved);
          filterByPriceRange(min, max, label);
        }
      } else {
        performSearch(lastQuery);
      }
    }else {
      // ✅ Default: show shuffled home
      const restored = restoreVisible.current;
      const count = restored ? restored : 20;
      setDisplayProducts(randomizedProducts.slice(0, count));
      setVisibleCount(count);
    }

    const savedFilter = sessionStorage.getItem("activeFilter");
    const savedBase = sessionStorage.getItem("baseFilteredProducts");

    if (savedBase) {
      const parsedBase = JSON.parse(savedBase);
      setBaseFilteredProducts(parsedBase);

      let restoredProducts = parsedBase;

      // ✅ Restore active filter (sort order)
      if (savedFilter) {
        setActiveFilter(savedFilter);
            const dropdown = document.querySelector('select');
              if (dropdown) {
                dropdown.value = savedFilter;
              }
        if (savedFilter === "high-low") {
          restoredProducts = [...parsedBase].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        } else if (savedFilter === "low-high") {
          restoredProducts = [...parsedBase].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        } else if (savedFilter === "latest" || savedFilter === "new") {
          restoredProducts = [...parsedBase].reverse();
        }
      }

      setFilteredProducts(restoredProducts);
      setDisplayProducts(restoredProducts);
      setVisibleCount(restoredProducts.length);

      if (lastQuery) {
        setSearchTerm(lastQuery);
      }

      setTimeout(() => setIsLoading(false), 200);
      return;
    }

    setTimeout(() => setIsLoading(false), 200);
  }, [randomizedProducts]);

  const [displayProducts, setDisplayProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[] | null>(null);
  const [activeFilter, setActiveFilter] = useState("best");
  const [visibleCount, setVisibleCount] = useState(20);

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = searchTerm;
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [baseFilteredProducts, setBaseFilteredProducts] = useState<Product[] | null>(null);

  const productsToShow = filteredProducts ?? randomizedProducts;
  // 🌀 Loading state for clicks/search/filter
  const [isLoading, setIsLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Prefetch all visible products (speeds up navigation)
    displayProducts.slice(0, 40).forEach(p => {
      router.prefetch(`/product/${p.id}`);
    });
  }, [displayProducts]);

  /* 🚀 Load initial 20 instantly */
  useEffect(() => {
    // 🧠 If search/filter is active, show ALL results
    if (filteredProducts !== null) {
      setDisplayProducts(productsToShow);
      setVisibleCount(productsToShow.length);
      } else {
        const restored = restoreVisible.current;
        const count = restored ? restored : 20;
        setDisplayProducts(productsToShow.slice(0, count));
        setVisibleCount(count);
      }
  }, [productsToShow, filteredProducts]);

  // ⚡️ Scroll to saved position once products are rendered (precise restore)
  useEffect(() => {
    if (restoreScrollY.current != null && displayProducts.length > 0) {
      const y = restoreScrollY.current;
      restoreScrollY.current = null;

      // Wait for the next few frames so layout fully stabilizes
      const restoreScroll = () => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: y, behavior: "instant" });
        });
      };

      // Try multiple times to ensure precise restore (helps with images lazy-loading)
      const attempts = [100, 250, 500];
      attempts.forEach(delay => setTimeout(restoreScroll, delay));
    }
  }, [displayProducts]);

  /* ♾️ Infinite Scroll */
  const handleScroll = useCallback(() => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 150) {
      setVisibleCount((prev) => {
        const next = prev + 20;
        const newCount = Math.min(next, productsToShow.length); // ✅ Cap at total length
        setDisplayProducts(productsToShow.slice(0, newCount));
        return newCount;
      });
    }
  }, [productsToShow]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);

    // ✅ Trigger scroll check once after restore
    const timer = setTimeout(() => {
      handleScroll();
    }, 300);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(timer);
    };
  }, [handleScroll]);


  /* 💡 Fuzzy Suggestions */
  useEffect(() => {
    const term = debouncedSearchTerm.trim().toLowerCase();
    if (!term || filteredProducts !== null) {
      setSuggestions([]);
      return;
    }

    // ✅ Step 1: get titles that start with term
    const startsWith = randomizedProducts.filter(p =>
      p.title.toLowerCase().startsWith(term)
    );

    // ✅ Step 2: then titles that include term
    const includes = randomizedProducts.filter(p =>
      p.title.toLowerCase().includes(term) && !p.title.toLowerCase().startsWith(term)
    );

    // ✅ Combine + deduplicate by title
    const combined = [...startsWith, ...includes];
    const unique = Array.from(new Map(combined.map(p => [p.title, p])).values());

    // ✅ Limit to top 10
    setSuggestions(unique.slice(0, 10));
  }, [debouncedSearchTerm, randomizedProducts, filteredProducts]);

  /* 🎯 Perform Search (Simple Grid Display) */
  const performSearch = async (term: string) => {
    const query = term.trim().toLowerCase();
    if (!query) return;

    // ⚡ Immediately show dummy skeleton results
    setIsLoading(true);
    const skeletons = Array.from({ length: 10 }).map((_, i) => ({
      id: `skeleton-${i}`,
      title: "Loading...",
      price: null,
      currency: "PKR",
      image: "/placeholder.png",
      link: "#",
    }));
    setDisplayProducts(skeletons);

    // 💡 Use a tiny delay to mimic "instant feedback"
    await new Promise(r => setTimeout(r, 50));

    // ⚙️ Perform actual Fuse search in background
    const fuse = new Fuse(randomizedProducts, {
      keys: [
        { name: "title", weight: 0.7 },
        { name: "description", weight: 0.2 },
        { name: "brand", weight: 0.1 },
      ],
      threshold: 0.6,
      includeScore: true,
    });

    const results = fuse.search(query).map(r => r.item);
    const uniqueResults = Array.from(new Set(results.map(p => p.id))).map(
      id => results.find(p => p.id === id)!
    );

    // 🧱 Fill with some randoms if too few
    const minResults = 20;
    let allMatched = [...uniqueResults];
    if (allMatched.length < minResults) {
      const fillers = shuffleArray(randomizedProducts)
        .filter(p => !allMatched.find(m => m.id === p.id))
        .slice(0, minResults - allMatched.length);
      allMatched = [...allMatched, ...fillers];
    }

    // ✅ Restore any existing active filter from sessionStorage (search filter persistence)
    const savedFilter = sessionStorage.getItem("activeFilter");

    let finalResults = [...allMatched];
    if (savedFilter === "high-low") {
      finalResults.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    } else if (savedFilter === "low-high") {
      finalResults.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    } else if (savedFilter === "latest" || savedFilter === "new") {
      finalResults.reverse();
    }

    // ✅ Apply results and persist
    setFilteredProducts(finalResults);
    setBaseFilteredProducts(allMatched);
    setDisplayProducts(finalResults);
    setVisibleCount(finalResults.length);

    setSuggestions([]);
    setSearchTerm(term);
    inputRef.current?.blur();

    window.history.pushState({ search: true }, "", "?search=" + encodeURIComponent(term));
    sessionStorage.setItem("lastQuery", term);
    sessionStorage.setItem("searchScrollY", "0");

    // 🌀 Smoothly remove skeleton after results are ready
    setTimeout(() => setIsLoading(false), 150);
  };

  /* 🎯 Filter by Subcategory (Show exactly all products under it, with +50% price) */
  const filterByCategory = (subcategoryName: string) => {
    setIsLoading(true);
    const matchedSub = catalogData.categories
      ?.flatMap((c: any) => c.subcategories || [])
      ?.find((s: any) => s.name?.toLowerCase() === subcategoryName.toLowerCase());

    // ✅ Apply +50% price increase here too
    const matchedProducts =
      matchedSub?.products?.map((p: any) => ({
        ...p,
        price: typeof p.price === "number" ? Math.round(p.price * 1.5) : null,
        currency: p.currency ?? "PKR",
        image: p.image ?? null,
      })) || [];

    setFilteredProducts(matchedProducts);
    setBaseFilteredProducts(matchedProducts);
    sessionStorage.setItem("baseFilteredProducts", JSON.stringify(matchedProducts));
    setDisplayProducts(matchedProducts);
    setVisibleCount(matchedProducts.length);
    setSuggestions([]);
    setSearchTerm(subcategoryName);
    inputRef.current?.blur();

    window.history.pushState(
      { search: true },
      "",
      "?subcategory=" + encodeURIComponent(subcategoryName)
    );
    sessionStorage.setItem("lastQuery", subcategoryName);
    sessionStorage.setItem("searchScrollY", "0");
    setTimeout(() => setIsLoading(false), 200);
  };

  const filterByPriceRange = (min: number, max: number, label: string) => {
    setIsLoading(true);

    const matchedProducts = randomizedProducts.filter(
      (p) => (p.price ?? 0) >= min && (p.price ?? 0) <= max
    );

    setFilteredProducts(matchedProducts);
    setBaseFilteredProducts(matchedProducts);
    sessionStorage.setItem("baseFilteredProducts", JSON.stringify(matchedProducts));
    setDisplayProducts(matchedProducts);
    setVisibleCount(matchedProducts.length);
    setSuggestions([]);
    setSearchTerm(label);
    inputRef.current?.blur();

    // ✅ Save the active filter range, so it can be restored
    const priceFilterData = JSON.stringify({ min, max, label });
    sessionStorage.setItem("activePriceFilter", priceFilterData);

    // ✅ Save the query to restore
    sessionStorage.setItem("lastQuery", label);
    window.history.pushState({ search: true }, "", "?price=" + encodeURIComponent(label));
    sessionStorage.setItem("searchScrollY", "0");

    setTimeout(() => setIsLoading(false), 200);
  };

  /* 🔙 Back navigation reset */
  useEffect(() => {
    const handlePopState = () => resetSearch();
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const resetSearch = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 200);
    setSearchTerm("");
    setFilteredProducts(null);
    setSuggestions([]);
    setDisplayProducts(randomizedProducts.slice(0, 20));
    setVisibleCount(20);
    sessionStorage.removeItem("searchScrollY");
    sessionStorage.removeItem("searchVisible");
    sessionStorage.removeItem("lastQuery");
    sessionStorage.removeItem("activeFilter");
    sessionStorage.removeItem("baseFilteredProducts");
    setActiveFilter("best");
    window.history.pushState(null, "", "/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchTerm);
  };

  const formatPrice = (price?: number | null, currency?: string | null) =>
    price == null ? "Price not available" : `${currency || "PKR"} ${price.toLocaleString()}`;

  const isSearchActive = filteredProducts !== null;
    // 🧭 Flags for restoring scroll
  const restoreScrollY = useRef<number | null>(null);
  const restoreVisible = useRef<number | null>(null);

  /* 🎞️ Promo Slides (Premium Styled) */
  const slides = [
    {
      text: "Upgrade your kitchen essentials with our premium collection.",
      highlight: "20% OFF",
      bg: "from-blue-50 via-blue-100 to-blue-200",
      badge: "bg-blue-600 text-white",
      icon: Utensils,
    },
    {
      text: "Cook smarter with modern cookware and save time every day.",
      highlight: "30% OFF",
      bg: "from-green-50 via-emerald-100 to-emerald-200",
      badge: "bg-emerald-600 text-white",
      icon: CookingPot,
    },
    {
      text: "Refresh your dining with elegant glassware and cutlery.",
      highlight: "Flat 40% OFF",
      bg: "from-rose-50 via-pink-100 to-rose-200",
      badge: "bg-rose-600 text-white",
      icon: CupSoda,
    },
    {
      text: "Discover smart kitchen appliances built for performance.",
      highlight: "New Launches",
      bg: "from-violet-50 via-purple-100 to-violet-200",
      badge: "bg-violet-600 text-white",
      icon: Refrigerator,
    },
    {
      text: "Keep your kitchen tidy with organizers & storage solutions.",
      highlight: "Smart Picks",
      bg: "from-amber-50 via-yellow-100 to-orange-200",
      badge: "bg-amber-600 text-white",
      icon: Boxes,
    },
    {
      text: "Clean easy with modern cleaning accessories for every kitchen.",
      highlight: "Top Rated",
      bg: "from-sky-50 via-cyan-100 to-sky-200",
      badge: "bg-sky-600 text-white",
      icon: Brush,
    },
    {
      text: "Stay hydrated with stylish bottles and drinkware.",
      highlight: "Best Sellers",
      bg: "from-orange-50 via-red-100 to-orange-200",
      badge: "bg-orange-600 text-white",
      icon: FlaskConical,
    },
    {
      text: "Perfect serveware for your dining table and celebrations.",
      highlight: "Premium Picks",
      bg: "from-teal-50 via-emerald-100 to-teal-200",
      badge: "bg-teal-600 text-white",
      icon: Salad,
    },
    {
      text: "Free delivery on orders above Rs 599 — shop more, save more!",
      highlight: "Free Delivery",
      bg: "from-lime-50 via-green-100 to-green-200",
      badge: "bg-green-600 text-white",
      icon: Truck,
    },
  ];

  // 🌀 Smooth Infinite Loop Slider
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => prev + 1);
      setIsTransitioning(true);
    }, 4000); // every 4s
    return () => clearInterval(interval);
  }, []);

  // ♻️ Reset position instantly when reaching duplicated end
  useEffect(() => {
    if (currentSlide === slides.length) {
      const timeout = setTimeout(() => {
        setIsTransitioning(false);
        setCurrentSlide(0); // jump back without flicker
      }, 700); // wait for transition to finish
      return () => clearTimeout(timeout);
    }
  }, [currentSlide, slides.length]);

  /* 🧱 Sub-categories */
  const subCategories = [
    { name: "Kitchen Accessories", icon: Utensils },
    { name: "Kitchen Organizers", icon: Boxes },
    { name: "Kitchen Appliances", icon: Refrigerator },
    { name: "Utensils", icon: Utensils },
    { name: "Cookware", icon: CookingPot },
    { name: "Bakeware", icon: Sandwich },
    { name: "Cleaning Accessories", icon: Brush },
    { name: "Bottles", icon: FlaskConical },
    { name: "Cutlery", icon: Soup },
    { name: "Trays & Dishes", icon: Salad },
    { name: "Glasses & Cups", icon: CupSoda },
    { name: "Plates & Bowls", icon: GlassWater },
  ];

     /* 💾 Save scroll + visible count in sessionStorage */
  useEffect(() => {
    const saveScroll = () => {
      const keyPrefix = isSearchActive ? "search" : "home";
      sessionStorage.setItem(`${keyPrefix}ScrollY`, String(window.scrollY));
      sessionStorage.setItem(`${keyPrefix}Visible`, String(visibleCount));
    };

    // Save periodically
    window.addEventListener("scroll", saveScroll);
    window.addEventListener("beforeunload", saveScroll);
    window.addEventListener("pagehide", saveScroll);

    return () => {
      window.removeEventListener("scroll", saveScroll);
      window.removeEventListener("beforeunload", saveScroll);
      window.removeEventListener("pagehide", saveScroll);
    };
  }, [isSearchActive, visibleCount]);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  // 🚀 Speed boost: prevent re-render delay when coming back
  useEffect(() => {
    if (document.visibilityState === "visible") {
      setIsLoading(false);
    }
  }, []);

  return (
    <>
    <Head>
      {/* ✅ Canonical URL */}
      <link rel="canonical" href="https://yourdomain.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="use-credentials" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <meta name="theme-color" content="#2563eb" />
      {/* ✅ Robots (Allow indexing) */}
      <meta name="robots" content="index, follow" />

      {/* ✅ Schema.org JSON-LD (Rich Snippet) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Store",
            name: "Premium Kitchen Store",
            url: "https://yourdomain.com",
            logo: "https://yourdomain.com/favicon.ico",
            description:
              "Shop the best kitchen essentials, cookware, utensils, organizers, and appliances.",
            sameAs: [
              "https://www.facebook.com/yourpage",
              "https://www.instagram.com/yourpage",
            ],
          }),
        }}
      />

      {/* ✅ Ads / Meta Pixel (only if needed) */}
      {/* Example: Google AdSense */}
      {/* <meta name="google-adsense-account" content="ca-pub-XXXXXXXXX" /> */}
    </Head>

      <main
        className="min-h-screen bg-gradient-to-br from-white via-blue-50/40 to-gray-100 
           mt-25 p-2 transition-all duration-300 ease-out"
        role="main"
      >
      {/* 🏠 Main Heading */}
      <div className="max-w-7xl mx-auto space-y-8">
      <h1 className="sr-only">
        Premium Kitchen Store – Cookware, Utensils & Accessories
      </h1>
      {/* 🔍 Search (fixed Top) */}
       <div
          className="fixed top-[72px] sm:top-[86px] z-[30] left-0 right-0 bg-transparent mt-6 flex items-center justify-center"
        >
        <div className="flex items-center w-full max-w-7xl p-2">
          {isSearchActive && (
            <button
              onClick={resetSearch}
              className="mr-2 text-blue-600 hover:text-blue-800"
              aria-label="Back"
            >
              <ArrowLeft size={24} />
            </button>
          )}

          <div className="w-full max-w-8xl px-3">
            <form onSubmit={handleSubmit} className="relative group">
              <div className="absolute inset-0 bg-white/60 backdrop-blur-xl border border-blue-100 rounded-2xl shadow-sm group-hover:shadow-lg transition-all"></div>
                <Search
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-600 z-10"
                  size={22}
                />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search kitchen products..."
                value={searchTerm}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchTerm(val);
                  if (val === "") {
                    setFilteredProducts(null);
                    setSuggestions([]);
                  }
                }}
                className="w-full pl-12 pr-10 py-3 rounded-xl border-2 border-blue-400 
                          backdrop-blur-sm shadow-sm focus:outline-none focus:ring-4 
                          focus:ring-blue-300 focus:border-blue-500 focus:shadow-lg 
                          transition duration-200"
              />

              {/* ❌ Clear */}
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setSuggestions([]);
                    inputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              )}

              {/* 💬 Suggestions */}
              {suggestions.length > 0 && (
                <ul className="absolute z-50 bg-white rounded-xl shadow-lg w-full mt-2 max-h-60 overflow-y-auto">
                  {suggestions.map((p) => (
                    <li
                      key={p.id}
                      onClick={() => {
                        setSearchTerm(p.title);
                        performSearch(p.title);
                        setSuggestions([]);
                      }}
                      className="p-2 hover:bg-gray-100 cursor-pointer"
                    >
                      {p.title}
                    </li>
                  ))}
                </ul>
              )}
            </form>
          </div>
        </div>
      </div>
    {!isSearchActive && (
      <>
     {/* 💰 Price Range Pills */}
      <div className="w-full overflow-x-auto scrollbar-hide px-2 sm:px-6">
        <div className="flex space-x-2 sm:space-x-3 py-2 min-w-max justify-center sm:gap-3">
          <button
            onClick={() => filterByPriceRange(0, 300, "Under 300")}
            className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 font-medium shadow-sm hover:bg-gray-200 transition-all"
          >
            Under 300
          </button>

          <button
            onClick={() => filterByPriceRange(300, 500, "Under 500")}
            className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 font-medium shadow-sm hover:bg-gray-200 transition-all"
          >
            Under 500
          </button>

          <button
            onClick={() => filterByPriceRange(500, 700, "Under 700")}
            className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 font-medium shadow-sm hover:bg-gray-200 transition-all"
          >
            Under 700
          </button>

          <button
            onClick={() => filterByPriceRange(700, 1000, "Under 999")}
            className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 font-medium shadow-sm hover:bg-gray-200 transition-all"
          >
            Under 999
          </button>

          <button
            onClick={() => filterByPriceRange(1000, 1500, "Under 1499")}
            className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 font-medium shadow-sm hover:bg-gray-200 transition-all"
          >
            Under 1499
          </button>

          <button
            onClick={() => filterByPriceRange(1500, 2000, "Under 1999")}
            className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 font-medium shadow-sm hover:bg-gray-200 transition-all"
          >
            Under 1999
          </button>
        </div>
      </div>
      </>
      )}

      {isSearchActive && filteredProducts && (
        <>
        <p className="text-center text-sm text-gray-600 mb-4">
          Showing <span className="font-semibold">{filteredProducts.length}</span> results for <span className="font-semibold">"{searchTerm}"</span>
        </p>
        
        {/* 🔽 Modern Filter Dropdown (Mobile Safe) */}
        <div className="relative w-44 sm:w-48">
          <select
            onChange={(e) => {
              const value = e.target.value;
              setActiveFilter(value);
              sessionStorage.setItem("activeFilter", value);
              setIsLoading(true);

              let sorted = [...(baseFilteredProducts ?? filteredProducts ?? displayProducts)];

              if (value === "best") {
                // ✅ Restore default (unsorted) base
                if (baseFilteredProducts) {
                  setDisplayProducts(baseFilteredProducts);
                  setFilteredProducts(baseFilteredProducts);
                  sessionStorage.setItem("baseFilteredProducts", JSON.stringify(baseFilteredProducts));
                }
                setTimeout(() => setIsLoading(false), 200);
                return;
              }

              if (value === "high-low") sorted.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
              else if (value === "low-high") sorted.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
              else if (value === "latest" || value === "new") sorted = [...sorted].reverse();
              else sorted = shuffleArray(sorted);

              // ✅ Save and display the sorted results persistently
              setFilteredProducts(sorted);
              setDisplayProducts(sorted);
              sessionStorage.setItem("baseFilteredProducts", JSON.stringify(sorted));

              setTimeout(() => setIsLoading(false), 200);
            }}
            value={activeFilter}
            className="w-full appearance-none border-2 border-blue-300 rounded-xl py-2 pl-3 pr-10 text-sm 
                      bg-white shadow-md focus:ring-4 focus:ring-blue-200 focus:border-blue-400 
                      transition-all duration-200 cursor-pointer"
          >
            <option value="best">Best Match</option>
            <option value="high-low">Price: High → Low</option>
            <option value="low-high">Price: Low → High</option>
            <option value="latest">Latest</option>
            <option value="new">New</option>
          </select>

          {/* ▼ Dropdown icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        </>
      )}
      
      {!isSearchActive && (
      <>
      {/* 🔁 Premium Edge-to-Edge Promo Slider */}
      <section
        aria-labelledby="promo-heading"
        className="relative w-full max-w-7xl mx-auto overflow-hidden rounded-2xl mb-8 mt-8 px-4"
      >
        <h2 id="promo-heading" className="sr-only">
          Promotional Highlights
        </h2>

        <div
          className={`flex ${isTransitioning ? "transition-transform duration-700 ease-in-out" : ""}`}
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {[...slides, slides[0]].map((slide, idx) => {
            const Icon = slide.icon;
            return (
              <div
                key={idx}
                className={`w-full flex-shrink-0 bg-gradient-to-br ${slide.bg} p-5 sm:p-8 rounded-xl shadow-md hover:shadow-xl transition-all duration-500 flex items-center justify-between`}
              >
                {/* 🧾 Text Section */}
                <div className="flex-1 pr-4">
                  <span
                    className={`inline-block px-3 py-1 mb-3 text-sm font-semibold rounded-full ${slide.badge} shadow-sm`}
                  >
                    {slide.highlight}
                  </span>
                  <p className="text-lg sm:text-xl font-semibold text-gray-800 leading-snug">
                    {slide.text}
                  </p>
                </div>

                {/* 🎯 Icon */}
                <div className="flex-shrink-0">
                  <div className="bg-white/70 backdrop-blur-sm p-4 rounded-full shadow-inner">
                    <Icon className="text-gray-700" size={48} strokeWidth={2.5} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent my-8"></div>

        {/* 🧱 Subcategory Slider */}
          <h2
              id="subcategory-heading"
              className="text-xl font-semibold text-center mb-4 text-gray-900"
            >
              Explore Kitchen Categories
            </h2>
          <section
          
            aria-labelledby="subcategory-heading"
            
            className="overflow-x-auto mb-6 scrollbar-hide"
          >
            
            <div className="flex justify-center lg:justify-center space-x-4 w-max px-2 mx-auto">
            {subCategories.map((cat, idx) => {
              const Icon = cat.icon;
              const colors = [
                "from-blue-100 to-blue-200 text-blue-700",
                "from-green-100 to-green-200 text-green-700",
                "from-purple-100 to-purple-200 text-purple-700",
                "from-amber-100 to-amber-200 text-amber-700",
                "from-pink-100 to-pink-200 text-pink-700",
                "from-teal-100 to-teal-200 text-teal-700",
                "from-cyan-100 to-cyan-200 text-cyan-700",
                "from-red-100 to-red-200 text-red-700",
                "from-lime-100 to-lime-200 text-lime-700",
                "from-sky-100 to-sky-200 text-sky-700",
                "from-orange-100 to-orange-200 text-orange-700",
                "from-fuchsia-100 to-fuchsia-200 text-fuchsia-700",
              ];
              const colorClass = colors[idx % colors.length];
              return (
                <button
                  key={idx}
                  onClick={() => filterByCategory(cat.name)}
                  className={`flex flex-col items-center min-w-[90px] max-w-[90px] transition-all duration-300 hover:-translate-y-1 hover:scale-105`}
                >
                  <div
                    className={`bg-gradient-to-br ${colorClass} w-[70px] h-[70px] flex items-center justify-center 
                      rounded-2xl shadow-md hover:shadow-xl backdrop-blur-xl bg-opacity-80 border border-white/60 transition-transform duration-300`}
                  >
                    <Icon size={28} strokeWidth={2.5} className="drop-shadow-md" />
                  </div>
                  <span className="mt-2 text-xs font-semibold text-gray-800 text-center leading-tight line-clamp-2">
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        </>
      )}

      {/* 🧱 Products */}
      <section
        aria-labelledby="products-heading"
        className="max-w-6xl mx-auto space-y-8"
      >
        <h2
          id="products-heading"
          className="text-xl font-semibold text-center mb-6 text-gray-900"
        >
          {isSearchActive
            ? `Search Results`
            : `Our Featured Kitchen Products`}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-fadeIn">

        {displayProducts.length > 0 ? (
          displayProducts.map((p) => {

          const fixedTags = ["Sale", "20% Off", "30% Off", "Hot", "New", ""]; 

          // 🔢 Create a small stable hash from the product ID
          const hash = p.id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
          const tag = fixedTags[hash % fixedTags.length];


          // 🎯 Calculate fake cut price if discount
          let displayPrice = p.price ?? 0;
          let cutPrice = null;
          if (tag === "30% Off") {
            cutPrice = Math.round(displayPrice * 1.3);
          } else if (tag === "20% Off") {
            cutPrice = Math.round(displayPrice * 1.2);
          } else if (tag === "Sale") {
            cutPrice = Math.round(displayPrice * 1.4);
          }

          return (
            <a
              key={p.id}
              href={`/product/${p.id}`}
              onMouseEnter={() => router.prefetch(`/product/${p.id}`)} // ⚡ Preload page on hover
              onTouchStart={() => router.prefetch(`/product/${p.id}`)} // ⚡ Preload on mobile tap
              onClick={() => {
                // 🧠 Save session + scroll before navigating
                const keyPrefix = isSearchActive ? "search" : "home";
                sessionStorage.setItem("homeScrollY", String(window.scrollY));
                sessionStorage.setItem(`${keyPrefix}ScrollY`, String(window.scrollY));
                sessionStorage.setItem(`${keyPrefix}Visible`, String(visibleCount));
                if (activeFilter) sessionStorage.setItem("activeFilter", activeFilter);
                if (isSearchActive && searchTerm) {
                  sessionStorage.setItem("lastQuery", searchTerm);
                  sessionStorage.setItem("baseFilteredProducts", JSON.stringify(baseFilteredProducts ?? []));
                }
                // ⚡ Optional: Hide loader flicker
                setIsLoading(false);
                window.history.scrollRestoration = "manual";
              }}
              className="relative bg-white/80 backdrop-blur-sm rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 
                flex flex-col overflow-hidden border border-gray-100 hover:-translate-y-1 hover:border-blue-200 hover:bg-white"
            >
              {/* 🏷️ Tag Badge */}
              {tag && (
                <span className="absolute top-2 left-2 text-xs font-bold text-white px-2 py-1 rounded-full shadow bg-red-600">
                  {tag}
                </span>
              )}

              {/* 🖼️ Image */}
              <img
                src={p.image || "/placeholder.png"}
                alt={p.title}
                className="object-cover aspect-square rounded-t-xl"
                loading="lazy"
              />
              {p.id.startsWith("skeleton-") && (
                <div className="p-3 flex flex-col flex-1">
                  <div className="skeleton h-4 w-3/4 rounded mb-2"></div>
                  <div className="skeleton h-3 w-1/2 rounded"></div>
                </div>
              )}
              {/* 💰 Price Info */}
              <div className="p-3 flex flex-col flex-1">
                <h2 className="font-semibold text-sm line-clamp-2 flex-1">{p.title}</h2>

                <div className="mt-2">
                  {/* 💸 Price */}
                  <div className="mt-2 flex flex-col items-start">
                  {/* 💸 Cut Price (Old) */}
                  {cutPrice && (
                    <div className="flex items-center space-x-2 mb-0.5">
                      <span className="text-gray-400 text-xs line-through">
                        {formatPrice(cutPrice, p.currency)}
                      </span>

                      <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
                        SAVE {((1 - displayPrice / cutPrice) * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                  {/* 💰 Actual Price (New) */}
                  <span className="text-blue-600 font-semibold text-base">
                    {formatPrice(displayPrice, p.currency)}
                  </span>
                </div>


                  {/* 🔽 Sale Price Drop */}
                  {tag === "Sale" && (
                    <div className="inline-flex items-center mt-1 px-2 py-0.5 text-xs text-blue-600 border border-blue-300 rounded-full">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                      Price Drop
                    </div>
                  )}
                </div>
              </div>
            </a>
          );
        })
        ) : (
          <p className="col-span-full text-center text-gray-500">
            {searchTerm ? "No results found" : "No products to display"}
          </p>
        )}
      </div>
     </section>

      {/* 🔄 Loading or No More */}
      {productsToShow.length > 0 && (
        <div className="text-center text-gray-500 mt-6">
          {visibleCount < productsToShow.length ? "Loading more..." : "No more products"}
        </div>
      )}
      </div>

      {/* 🌫️ Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-300">
          <div className="flex flex-col items-center space-y-2">
            <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-blue-700 font-medium text-sm">Loading...</p>
          </div>
        </div>
      )}
      <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`sticky bottom-6 left-100 sm:left-2 z-60 p-3 rounded-full shadow-lg transition-all duration-300
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"}
        bg-gradient-to-r from-blue-500 to-indigo-600 text-white
        hover:from-blue-600 hover:to-indigo-700
        hover:shadow-[0_0_15px_rgba(59,130,246,0.5)]
        backdrop-blur-md border border-white/20
      `}
      aria-label="Back to top"
    >
      <ArrowUp size={22} strokeWidth={2.5} />
    </button>

    </main>
    </>
  );
}
