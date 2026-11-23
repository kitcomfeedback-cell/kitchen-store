"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import catalogData from "../../data/catalog.json";
import { useSwipeable } from "react-swipeable";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  X,
  Plus,
  Minus,
  ShoppingCart,
  CreditCard,
  Tag,
  ChevronDown,  
  XCircle,
  ArrowLeft,
  ChevronLeft, 
  CornerUpLeft,
} from "lucide-react";

const PRODUCT_IMAGE_HOSTS = [
  "static.markaz.app",
  "content.public.markaz.app",
  "www.shop.markaz.app",
];

function isUsableProductImage(value?: string | null): boolean {
  if (!value || typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      PRODUCT_IMAGE_HOSTS.includes(url.hostname) &&
      !/placeholder|markaz_logo_mobile|\.svg(?:$|\?)/i.test(url.pathname);
  } catch {
    return false;
  }
}

function stripSupplierProductCodes(value: string): string {
  return value
    .replace(/\s*[,;|•-]?\s*Product\s*Code\s*:\s*[A-Z0-9_-]+/gi, "")
    .replace(/\bMZ[A-Z0-9_-]{8,}\b/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cleanProductDescription(value?: string): string[] {
  if (!value) return [];
  const cleaned = stripSupplierProductCodes(value)
    .replace(/\s+-\s+/g, "\n")
    .replace(/\s+(?=(?:Material|Number\s+Of\s+Pieces|Product\s+Feature|Color|Colors|Package\s+Includes|Length|Width|Height|Set\s+Of|Note|Size|Sizes|Capacity|Weight)\s*:)/gi, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  return cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractOptionValues(description: string | undefined, label: "Color" | "Size"): string[] {
  if (!description) return [];
  const clean = stripSupplierProductCodes(description).replace(/\s+/g, " ");
  const labels = "(?:Material|Number\\s+Of\\s+Pieces|Product\\s+Feature|Colors?|Package\\s+Includes|Length|Width|Height|Set\\s+Of|Note|Sizes?|Capacity|Weight)";
  const match = clean.match(new RegExp("(?:^|[\\s;,|])" + label + "s?\\s*:\\s*(.+?)(?=\\s+(?:" + labels + ")\\s*:|$)", "i"));
  if (!match) return [];

  const genericValues = label === "Color"
    ? /^(?:multi[ -]?colou?r|assorted|mixed|mix|random|various|any|other|standard|default|n\/?a|none)$/i
    : /^(?:one size|free size|standard size|universal size|assorted|mixed|random|various|any|other|standard|default|n\/?a|none)$/i;

  return match[1]
    .split(/\s*(?:,|\/|\||;|\bor\b)\s*/i)
    .map((value) => value.replace(/[.!]+$/, "").trim())
    .filter((value) =>
      value.length > 0 &&
      value.length <= 24 &&
      !genericValues.test(value) &&
      !/package|includes|note|manual measurement|lighting|monitor effects|\b(?:pcs?|pieces?|kgs?|kg|grams?|capacity|weight)\b/i.test(value) &&
      (label !== "Size" || /^(?:xxs|xs|s|m|l|xl|xxl|xxxl|\d{1,3}(?:\.\d+)?(?:\s?(?:cm|mm|inches?|in|ft))?)$/i.test(value))
    )
    .filter((value, index, all) => all.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index)
    .slice(0, 12);
}

export default function ProductPage() {
  const { id } = useParams(); // ✅ Dynamic product ID from URL
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [showDescription, setShowDescription] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [extraInfo, setExtraInfo] = useState("");
  const [couponError, setCouponError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [failedRelatedIds, setFailedRelatedIds] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!showGallery) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showGallery]);

  const router = useRouter();

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => setCurrentIndex((prev) => (prev + 1) % images.length),
    onSwipedRight: () => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length),
  });

  type Product = {
  id: string;
  title: string;
  price: number;  
  currency: string;
  image?: string;
  images?: string[];
  description?: string;
  category?: string;
  subcategory?: string;
  [key: string]: any;
};

  // ✅ Fetch product by ID
  useEffect(() => {
    let foundProduct = null;
    for (const c of catalogData.categories || []) {
      for (const s of c.subcategories || []) {
        const match = s.products?.find((p: any) => p.id === id);
        if (match) {
        // 🪄 Attach category and subcategory names so TS recognizes them
        foundProduct = {
        ...match,
        category: c.name || "Unknown",
        subcategory: s.name || "Unknown",
        price: typeof match.price === "number" ? match.price : 0, // ✅ fallback to 0
        currency: match.currency || "PKR", // ✅ fallback to PKR
        image: isUsableProductImage(match.image)
          ? match.image
          : (Array.isArray(match.images)
              ? match.images.find((image: string) => isUsableProductImage(image))
              : undefined),
        };
        break;
        }
      }
    }
    // ✅ Find related products smartly
    if (foundProduct) {
    setProduct(foundProduct);

    // Get all products
    const allProducts = catalogData.categories
    .flatMap((c: any) =>
      (c.subcategories || []).flatMap((s: any) =>
        (s.products || []).map((p: any) => ({
          ...p,
          category: c.name,
          subcategory: s.name,
          price:
            typeof p.price === "number" && p.price > 0
              ? p.price
              : null,
          image: isUsableProductImage(p.image) ? p.image : null,
          images: Array.isArray(p.images) ? p.images.filter((img: string) => isUsableProductImage(img)) : [],
        }))
      )
    )
    // 🚫 HARD FILTER (THIS FIXES EVERYTHING)
    .filter(
      (p: any) =>
        p.price !== null &&
        p.price > 0 &&
        (p.image !== null || p.images.length > 0)
    )
    .map((p: any) => ({
      ...p,
      image: p.image || p.images[0],
    }));

    // 1️⃣ Try products in same subcategory
    let related = allProducts.filter(
        (p: any) =>
        p.id !== foundProduct.id &&
        foundProduct.subcategory &&
        p.subcategory === foundProduct.subcategory
    );

    // 2️⃣ If less than 10, add products from same category
    if (related.length < 10 && foundProduct.category) {
        const sameCategory = allProducts.filter(
        (p: any) =>
            p.id !== foundProduct.id &&
            foundProduct.category &&
            p.category === foundProduct.category &&
            !related.some((r) => r.id === p.id)
        );
        related = [...related, ...sameCategory];
    }

    // 3️⃣ If still less than 10, match by title keywords
    if (related.length < 10) {
        const productWords = (foundProduct.title || "")
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2);

        const keywordMatches = allProducts
        .filter((p: any) => p.id !== foundProduct.id)
        .map((p: any) => {
            const score = productWords.reduce((acc, word) => {
            return acc + (p.title?.toLowerCase().includes(word) ? 1 : 0);
            }, 0);
            return { ...p, score };
        })
        .filter((p) => p.score > 0)
        .sort((a, b) => b.score - a.score);

        related = [...related, ...keywordMatches];
    }

    // 🧹 Remove duplicates & limit to 50
    const unique = Array.from(new Map(related.map((p) => [p.id, p])).values());
    setRelatedProducts(unique.slice(0, 50));
    }

  }, [id]);

  if (!product) {
      return <div className="p-6 text-center text-gray-500">Loading...</div>;
    }

  // Use every valid gallery image, while never substituting a fake placeholder.
  const validImages = [
    ...(Array.isArray(product.images) ? product.images : []),
    product.image,
  ]
    .filter(
      (img): img is string =>
        typeof img === "string" &&
        isUsableProductImage(img) &&
        !failedImages.includes(img)
    )
    .filter((img, index, all) => all.indexOf(img) === index);

  const images = validImages;

  if (images.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 rounded-full bg-gray-100 p-5 text-gray-400">
          <XCircle size={36} />
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Product currently unavailable</h1>
        <p className="mt-2 text-sm text-gray-600">This product does not have a valid image and is temporarily hidden from the store.</p>
        <button onClick={() => router.back()} className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700">Go back</button>
      </div>
    );
  }

  const applyCoupon = () => {
    const validCoupons: Record<string, number> = {
      SAVE20: 0.2,
    };

    // ✅ Step 1: calculate increased price
    const increasedPrice = (product?.price || 0) * 1.5;

    // ✅ Step 2: eligibility check on increased price
    if (increasedPrice <= 599) {
      setCouponError("Coupons apply only on orders above Rs. 599");
      setAppliedCoupon(null);
      return;
    }

    // ✅ Step 3: validate coupon
    const code = coupon.toUpperCase();
    if (validCoupons[code]) {
      setAppliedCoupon(code);
      setCouponError("");
    } else {
      setAppliedCoupon(null);
      setCouponError("Invalid coupon code");
    }
  };

const basePrice = (product.price || 0) * 1.5;

const discount =
  appliedCoupon === "SAVE20" && basePrice >= 599
    ? 0.2
    : 0;

const displayPrice = Math.round(basePrice * (1 - discount));

const addToCart = (goCheckout = false) => {
  if (!product) return;

  // ✅ Get existing cart or initialize empty
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");

  // ✅ Check if product already exists in cart
  const existingIndex = cart.findIndex((x: any) => x.id === product.id);


  // ✅ Compute price and discount
  const basePrice = (product.price || 0) * 1.5;
  const discount =
    appliedCoupon && appliedCoupon === "SAVE10"
      ? 0.1
      : appliedCoupon === "SAVE20"
      ? 0.2
      : 0;
  const unitPrice = Math.round(basePrice * (1 - discount));

  const subtotal = unitPrice * quantity;
  const deliveryCharge = subtotal < 600 ? 100 : 0;
  const inflatedPrice = Math.round((product.price || 0) * 1.5);

  // ✅ Build the cart item
  const item = {
    id: product.id,
    title: product.title,
    image: product.image || "/placeholder.png",
    price: unitPrice,
    qty: quantity,
    note: note || "",
    size: selectedSize || null,
    color: selectedColor || null,
    category: product.category || null,
    subcategory: product.subcategory || null,

    meta: {
      original_price: inflatedPrice, // ✅ FIXED
      coupon: appliedCoupon || null,
      discount_pct: discount * 100,
      discount_amount_per_unit: inflatedPrice - unitPrice, // ✅ important
      delivery_charge: deliveryCharge,
      subtotal,
      total_with_delivery: subtotal + deliveryCharge,
    },

  };

  // ✅ Add or update cart
  if (existingIndex >= 0) {
    cart[existingIndex] = {
      ...cart[existingIndex],
      qty: cart[existingIndex].qty + quantity,
    };
  } else {
    cart.push(item);
  }

  // ✅ Save cart
  localStorage.setItem("cart", JSON.stringify(cart));

  // ✅ Trigger global event (if you have a cart counter)
  window.dispatchEvent(new Event("cartUpdated"));

  // ✅ Toast feedback
  toast.success(goCheckout ? "Proceeding to checkout..." : "Added to cart!");

  // ✅ Navigate if Buy Now
  if (goCheckout) {
    router.push("/cart?checkout=1");
  }
};

  return (
  <div className="max-w-6xl mx-auto p-4 sm:p-8 bg-white rounded-2xl shadow-sm">
    {/* ⬅️ Cool Back Button */}
    <button
      onClick={() => router.back()}
    >
      <ArrowLeft size={35} className="text-black" />
    </button>
    {/* 🧱 Main Layout: Image Left, Details Right */}
    <div className="flex flex-col lg:flex-row gap-8">
      
      {/* 🖼️ Image Slider (Left) */}
      <div className="w-full lg:w-1/2 flex flex-col items-center">
        {/* 🖼️ Image Slider with Dots */}
        <div
          className="w-full overflow-hidden rounded-2xl shadow-md mb-4 relative"
          {...swipeHandlers}
        >
          <div
            className="flex transition-transform duration-700 ease-in-out"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {images.map((img: string, i: number) => (
              <div
                key={i}
                className="w-full flex-shrink-0"
                onClick={() => {
                  setCurrentIndex(i);
                  setSelectedImage(img);
                  setShowGallery(true);
                }}
              >
                <Image
                  src={img}
                  alt={product.title}
                  width={600}
                  height={600}
                  priority
                  unoptimized
                  onError={() => {
                    setFailedImages((previous) => previous.includes(img) ? previous : [...previous, img]);
                    setCurrentIndex((previous) => Math.min(previous, Math.max(0, images.length - 2)));
                  }}
                  className="object-contain w-full h-[500px] rounded-2xl cursor-pointer bg-white"
                />
              </div>
            ))}
          </div>

          {/* ◀️ Prev */}
          <button
            onClick={() =>
              setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
            }
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 text-white p-2 rounded-full hover:bg-black/60 transition"
          >
            ‹
          </button>

          {/* ▶️ Next */}
          <button
            onClick={() => setCurrentIndex((prev) => (prev + 1) % images.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 text-white p-2 rounded-full hover:bg-black/60 transition"
          >
            ›
          </button>

          {/* ⚪ Dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-2">
            {images.map((_: string, i: number) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-3 h-3 rounded-full transition-all ${
                  i === currentIndex ? "bg-blue-500 scale-110" : "bg-gray-300"
                }`}
              ></button>
            ))}
          </div>
        </div>
      </div>

      {/* Full-screen product image viewer */}
      {showGallery && typeof document !== "undefined" && createPortal((
        <div
          className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen flex-col overflow-hidden bg-black text-white"
          role="dialog"
          aria-modal="true"
          aria-label="Product image gallery"
          onKeyDown={(event) => {
            if (event.key === "Escape") setShowGallery(false);
            if (event.key === "ArrowRight") {
              const next = (currentIndex + 1) % images.length;
              setCurrentIndex(next);
              setSelectedImage(images[next]);
            }
            if (event.key === "ArrowLeft") {
              const prev = (currentIndex - 1 + images.length) % images.length;
              setCurrentIndex(prev);
              setSelectedImage(images[prev]);
            }
          }}
          tabIndex={-1}
          autoFocus
        >
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3 sm:px-7">
            <div className="min-w-0 pr-4">
              <p className="truncate text-sm font-semibold sm:text-base">{product.title}</p>
              <p className="mt-0.5 text-xs text-white/60">{currentIndex + 1} / {images.length}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowGallery(false)}
              aria-label="Close image viewer"
              className="rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
            >
              <X size={25} />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-12 py-2 sm:px-20">
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => {
                const prev = (currentIndex - 1 + images.length) % images.length;
                setCurrentIndex(prev);
                setSelectedImage(images[prev]);
              }}
              disabled={images.length < 2}
              className="absolute left-2 z-10 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/25 disabled:opacity-30 sm:left-6"
            >
              <ChevronLeft size={28} />
            </button>

            <img
              src={images[currentIndex] || selectedImage || images[0]}
              alt={product.title}
              className="block h-[78dvh] w-[85vw] select-none object-contain"
              draggable={false}
              onError={() => {
                const failed = images[currentIndex];
                if (failed) {
                  setFailedImages((previous) => previous.includes(failed) ? previous : [...previous, failed]);
                  setCurrentIndex((previous) => Math.min(previous, Math.max(0, images.length - 2)));
                }
              }}
            />

            <button
              type="button"
              aria-label="Next image"
              onClick={() => {
                const next = (currentIndex + 1) % images.length;
                setCurrentIndex(next);
                setSelectedImage(images[next]);
              }}
              disabled={images.length < 2}
              className="absolute right-2 z-10 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/25 disabled:opacity-30 sm:right-6"
            >
              <ChevronLeft className="rotate-180" size={28} />
            </button>
          </div>

          {images.length > 1 && (
            <div className="shrink-0 border-t border-white/10 px-3 py-3 sm:px-6">
              <div className="mx-auto flex max-w-full gap-2 overflow-x-auto pb-1">
                {images.map((img, index) => (
                  <button
                    type="button"
                    key={img}
                    onClick={() => {
                      setCurrentIndex(index);
                      setSelectedImage(img);
                    }}
                    aria-label={"Show image " + (index + 1)}
                    aria-current={index === currentIndex ? "true" : undefined}
                    className={"h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition sm:h-20 sm:w-20 " + (index === currentIndex ? "border-white" : "border-white/20 opacity-65 hover:opacity-100")}
                  >
                    <img
                      src={img}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={() => setFailedImages((previous) => previous.includes(img) ? previous : [...previous, img])}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ), document.body)}

      {/* 🧾 Product Info (Right) */}
      <div className="w-full lg:w-1/2 mt-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
          {product.title}
        </h1>

        {/* 💰 Price + Discount */}
        <div className="flex items-center space-x-3 mb-2">
          {product.price && (
            <>
              {appliedCoupon ? (
                <>
                  {/* Show inflated 50% price crossed out */}
                  <span className="text-gray-400 line-through text-lg">
                    PKR {(product.price * 1.5).toLocaleString()}
                  </span>

                  {/* Show discounted (20% off) final price */}
                  <span className="text-2xl font-bold text-blue-600">
                    PKR {displayPrice.toLocaleString()}
                  </span>

                  {/* Discount label */}
                  <span className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">
                    -{(discount * 100).toFixed(0)}%
                  </span>
                </>
              ) : (
                <>
                  {/* When no coupon, just show original price normally */}
                  <span className="text-2xl font-bold text-blue-600">
                    PKR {(product.price * 1.5).toLocaleString()}
                  </span>
                </>
              )}
            </>
          )}
        </div>

        {/* 🚚 Delivery Charges */}
        <p className="text-sm text-gray-600 mb-4">
          Delivery Charges:{" "}
          {displayPrice <= 599 ? (
            <span className="font-semibold text-red-500">Rs.100</span>
          ) : (
            <span className="font-semibold text-green-600">Free</span>
          )}
        </p>

        {/* 📝 Description Dropdown */}
        <div className="mb-6">
        <button
            onClick={() => setShowDescription((prev) => !prev)}
            className="w-full flex items-center justify-between bg-gray-100 px-4 py-3 rounded-xl text-gray-800 font-semibold hover:bg-gray-200 transition"
        >
            <span>Product Description</span>
            <ChevronDown
            className={`transition-transform duration-300 ${
                showDescription ? "rotate-180" : ""
            }`}
            />
        </button>

        {showDescription && product.description && (
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h3 className="mb-3 text-base font-semibold text-gray-800">Product Description</h3>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-gray-700">
              {cleanProductDescription(product.description).map((line, i) => (
                <li key={i} className="break-words">{line}</li>
              ))}
            </ul>
          </div>
        )}
        </div>

        {(() => {
          const colors = extractOptionValues(product.description, "Color");
          const sizes = extractOptionValues(product.description, "Size");
          if (colors.length === 0 && sizes.length === 0) return null;

          return (
            <div className="mt-4 mb-7 space-y-4 rounded-xl border border-gray-100 bg-gray-50/60 p-3 sm:p-4">
              {colors.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-800">Available Colors</h3>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((color) => (
                      <button
                        type="button"
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={"rounded-full border px-4 py-2 text-sm font-medium capitalize transition " + (selectedColor === color ? "border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-100" : "border-gray-300 bg-white text-gray-700 hover:border-blue-400")}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {sizes.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-800">Available Sizes</h3>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((size) => (
                      <button
                        type="button"
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={"min-w-12 rounded-lg border px-4 py-2 text-sm font-medium transition " + (selectedSize === size ? "border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-100" : "border-gray-300 bg-white text-gray-700 hover:border-blue-400")}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* 🎟️ Coupon Bar */}
        <div className="mt-6 mb-6 flex w-full min-w-0 items-center gap-2">
        <input
        type="text"
        value={coupon}
        onChange={(e) => setCoupon(e.target.value)}
        onKeyDown={(e) => {
            if (e.key === "Enter") {
            e.preventDefault();
            applyCoupon();
            }
        }}
        placeholder="Enter coupon code"
        className="min-w-0 flex-1 rounded-xl border-2 border-blue-300 px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
            onClick={applyCoupon}
            className="shrink-0 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
        >
            Apply
        </button>
        </div>
        {couponError && (
            <p className="text-red-500 text-sm mt-1">{couponError}</p>
        )}

        {/* 🎟️ Applied Coupon */}
        {appliedCoupon && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 mb-6">
            <div className="flex items-center space-x-2">
            <Tag className="text-blue-600" size={18} />
            <span className="font-semibold text-blue-700">
                {appliedCoupon} Applied
            </span>
            </div>
            <button
            onClick={() => setAppliedCoupon(null)}
            className="text-blue-500 hover:text-red-500 transition"
            >
            <XCircle size={20} />
            </button>
        </div>
        )}

        {/* 📝 Note Field */}
        <div className="mb-6">
        <label className="block font-semibold mb-2">Add a Note (Optional)</label>
        <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Enter any notes or instructions..."
            className="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            rows={3}
        />
        </div>

        {/* 🔢 Quantity */}
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="p-2 border rounded-full hover:bg-gray-100"
          >
            <Minus size={18} />
          </button>
          <span className="text-lg font-semibold">{quantity}</span>
          <button
            onClick={() => setQuantity((q) => q + 1)}
            className="p-2 border rounded-full hover:bg-gray-100"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* 🛒 Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => addToCart(false)}
            className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
          >
            <ShoppingCart size={20} />
            <span>Add to Cart</span>
          </button>

          <button
            onClick={() => addToCart(true)}
            className="flex-1 flex items-center justify-center space-x-2 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition"
          >
            <CreditCard size={20} />
            <span>Buy Now</span>
          </button>
        </div>

      </div>
      </div>

      {/* 🧭 Related Products */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold mb-4">You may also like</h2>

        {/* Multiple sliders */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="mb-6">
            <div className="flex space-x-4 overflow-x-auto scrollbar-hide">
              {relatedProducts
               .filter(p => p.price > 0 && p.image && !failedRelatedIds.includes(p.id))
               .slice(i * 10, i * 10 + 10).map((p) => (
                <a
                  key={p.id}
                  href={`/product/${p.id}`}
                  className="min-w-[140px] bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-100 p-2 transition"
                >
                  <img
                    src={p.image || "/placeholder.png"}
                    alt={p.title}
                    className="w-full h-24 object-cover rounded-lg mb-2"
                    loading="lazy"
                    onError={() => setFailedRelatedIds((previous) => previous.includes(p.id) ? previous : [...previous, p.id])}
                  />
                  <p className="text-sm font-medium line-clamp-2">{p.title}</p>
                  <p className="text-blue-600 text-sm font-semibold mt-1">
                    PKR {Math.round(p.price * 1.5).toLocaleString()}
                  </p>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
