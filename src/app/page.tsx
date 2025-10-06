"use client";

import { metadata } from "./metadata"; 
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import {
  ArrowLeft,
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

/* ⏱ Debounce Hook */
const useDebounce = (value: string, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounced;
};

export default function HomePage() {
  /* 🧱 All Products (+50% price) */
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

  const [displayProducts, setDisplayProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[] | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [baseFilteredProducts, setBaseFilteredProducts] = useState<Product[] | null>(null);

  const productsToShow = filteredProducts ?? randomizedProducts;

  /* 🚀 Load initial 20 instantly */
  useEffect(() => {
    // 🧠 If search/filter is active, show ALL results
    if (filteredProducts !== null) {
      setDisplayProducts(productsToShow);
      setVisibleCount(productsToShow.length);
    } else {
      // 🌀 Otherwise, show 20 products initially and use infinite scroll
      setDisplayProducts(productsToShow.slice(0, 20));
      setVisibleCount(20);
    }
  }, [productsToShow, filteredProducts]);

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
    return () => window.removeEventListener("scroll", handleScroll);
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
  const performSearch = (term: string) => {
    const query = term.trim().toLowerCase();
    if (!query) return;

    const fuse = new Fuse(randomizedProducts, {
      keys: [
        { name: "title", weight: 0.7 },
        { name: "description", weight: 0.2 },
        { name: "brand", weight: 0.1 },
      ],
      threshold: 0.6, // a bit lenient so similar items appear
      includeScore: true,
    });

    const results = fuse.search(query).map(r => r.item);

    // ✅ Remove duplicates, but keep all matching products (even from same category)
    const uniqueResults = Array.from(new Set(results.map(p => p.id))).map(
      id => results.find(p => p.id === id)!
    );

    // ✅ Add fillers if too few
    const minResults = 20;
    let allMatched = [...uniqueResults];
    if (allMatched.length < minResults) {
      const fillers = shuffleArray(randomizedProducts)
        .filter(p => !allMatched.find(m => m.id === p.id))
        .slice(0, minResults - allMatched.length);
      allMatched = [...allMatched, ...fillers];
    }

    // ✅ Show all products in grid
    setFilteredProducts(allMatched);
    setBaseFilteredProducts(allMatched); 
    setDisplayProducts(allMatched);
    setVisibleCount(allMatched.length);
    setSuggestions([]);
    inputRef.current?.blur();
    setSearchTerm(term);

    window.history.pushState({ search: true }, "", "?search=" + encodeURIComponent(term));
  };

  /* 🎯 Filter by Subcategory (Show exactly all products under it, with +50% price) */
  const filterByCategory = (subcategoryName: string) => {
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
  };

  /* 🔙 Back navigation reset */
  useEffect(() => {
    const handlePopState = () => resetSearch();
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const resetSearch = () => {
    setSearchTerm("");
    setFilteredProducts(null);
    setSuggestions([]);
    setDisplayProducts(randomizedProducts.slice(0, 20));
    setVisibleCount(20);
    window.history.replaceState(null, "", "/");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchTerm);
  };

  const formatPrice = (price?: number | null, currency?: string | null) =>
    price == null ? "Price not available" : `${currency || "PKR"} ${price.toLocaleString()}`;

  const isSearchActive = filteredProducts !== null;

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

const [currentSlide, setCurrentSlide] = useState(0);
useEffect(() => {
  const timer = setInterval(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, 5000);
  return () => clearInterval(timer);
}, [slides.length]);

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

  return (
    <>
    <Head>
      {/* ✅ Canonical URL */}
      <link rel="canonical" href="https://yourdomain.com" />

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

    <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 p-4 mt-17.5" role="main">
      {/* 🏠 Main Heading */}
      <div className="max-w-7xl mx-auto space-y-8">
      <h1 className="sr-only">
        Premium Kitchen Store – Cookware, Utensils & Accessories
      </h1>
      {/* 🔍 Search (Sticky Top) */}
       <div
        className={`fixed top-[62px] left-0 right-0 z-40 bg-gray-50/90 backdrop-blur-md 
                    flex items-center justify-center border-b border-gray-200 shadow-sm`}
      >
        <div className="flex items-center w-full max-w-7xl p-4">
          {isSearchActive && (
            <button
              onClick={resetSearch}
              className="mr-2 text-blue-600 hover:text-blue-800"
              aria-label="Back"
            >
              <ArrowLeft size={24} />
            </button>
          )}

          <form onSubmit={handleSubmit} className="flex-1 relative group">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600 z-10"
              size={22}
            />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search kitchen products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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

      {isSearchActive && filteredProducts && (
        <>
        <p className="text-center text-sm text-gray-600 mb-4">
          Showing <span className="font-semibold">{filteredProducts.length}</span> results for <span className="font-semibold">"{searchTerm}"</span>
        </p>
        
        {/* 🔽 Filter Dropdown */}
      <div className="flex justify-end max-w-6xl mx-auto mb-4">
        <select
          onChange={(e) => {
          const value = e.target.value;

          if (value === "best") {
            // ✅ restore to original search/category results
            if (baseFilteredProducts) {
              setDisplayProducts(baseFilteredProducts);
            }
            return;
          }

          let sorted = [...displayProducts];

          if (value === "high-low") {
            sorted.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
          } else if (value === "low-high") {
            sorted.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
          } else if (value === "latest" || value === "new") {
            sorted = shuffleArray(sorted);
          }

          setDisplayProducts(sorted);
        }}
          className="border border-blue-400 rounded-lg p-2 text-sm text-gray-700 bg-white shadow-sm focus:ring-2 focus:ring-blue-300"
        >
          <option value="best">Best Match</option>
          <option value="high-low">Price: High to Low</option>
          <option value="low-high">Price: Low to High</option>
          <option value="latest">Latest</option>
          <option value="new">New</option>
        </select>
      </div>
        </>
      )}
      
      {!isSearchActive && (
      <>
      {/* 🔁 Premium Edge-to-Edge Promo Slider */}
      <section
        aria-labelledby="promo-heading"
        className="relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] overflow-hidden mb-8"
      >
        <h2 id="promo-heading" className="sr-only">
          Promotional Highlights
        </h2>

        <div
          className="flex transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {slides.map((slide, idx) => {
          const Icon = slide.icon;
          return (
            <div
              key={idx}
              className={`w-full flex-shrink-0 bg-gradient-to-br ${slide.bg} p-5 sm:p-8 rounded-none sm:rounded-2xl shadow-md hover:shadow-xl transition-all duration-500 flex items-center justify-between`}
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
                  className={`flex flex-col items-center min-w-[90px] max-w-[90px] transition-transform hover:-translate-y-1`}
                >
                  <div
                    className={`bg-gradient-to-br ${colorClass} w-[70px] h-[70px] flex items-center justify-center rounded-2xl shadow-md hover:shadow-lg`}
                  >
                    <Icon size={28} strokeWidth={2.5} />
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
              className="relative bg-white/90 backdrop-blur-sm rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden border border-gray-100"
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
    </main>
    </>
  );
}
