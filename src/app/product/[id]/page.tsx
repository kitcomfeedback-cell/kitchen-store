"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import catalogData from "../../data/catalog.json";
import {  } from "lucide-react";
import { useSwipeable } from "react-swipeable";
import Image from "next/image";
import {
  X,
  Plus,
  Minus,
  ShoppingCart,
  CreditCard,
  Tag,
  ChevronDown,  
  XCircle,
} from "lucide-react";

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
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [note, setNote] = useState("");

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
        image: match.image || "/placeholder.png", // ✅ fallback image
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
        .flatMap((c: any) => c.subcategories)
        .flatMap((s: any) => s.products);

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

 const images = (product.images?.filter(
  (img: string) => img !== "https://www.shop.markaz.app/markaz_logo_mobile.png"
 ) || [product.image || "/placeholder.png"]);

  const applyCoupon = () => {
    // ✅ Dummy coupon logic
    const validCoupons: Record<string, number> = {
    SAVE10: 0.1,
    SAVE20: 0.2,
    };

    if (validCoupons[coupon.toUpperCase()]) {
    setAppliedCoupon(coupon.toUpperCase());
    setCouponError("");
    } else {
    setAppliedCoupon(null);
    setCouponError("Invalid coupon code");
    // Optional: trigger cute toaster instead of label
    // toast.error("Invalid coupon code");
    }
  };

  const discount =
    appliedCoupon && appliedCoupon === "SAVE10"
      ? 0.1
      : appliedCoupon === "SAVE20"
      ? 0.2
      : 0;

  // Default rule: increase base price by 50%, then apply discount
  const basePrice = (product.price || 0) * 1.5;
  const displayPrice = Math.round(basePrice * (1 - discount));


  return (
  <div className="max-w-6xl mx-auto p-4 sm:p-8 bg-white rounded-2xl shadow-sm">
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
              <Image
                key={i}
                src={img}
                alt={product.title}
                width={600}
                height={600}
                priority
                className="object-cover w-full h-auto rounded-2xl flex-shrink-0"
              />
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

      {/* 🔍 Fullscreen Image Modal */}
      {showGallery && selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          <button
            onClick={() => setShowGallery(false)}
            className="absolute top-6 right-6 text-white hover:text-red-400"
          >
            <X size={36} />
          </button>
          <img
            src={selectedImage}
            alt="fullscreen"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
          />
        </div>
      )}

      {/* 🧾 Product Info (Right) */}
      <div className="w-full lg:w-1/2 mt-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
          {product.title}
        </h1>

        {/* 💰 Price + Discount */}
        <div className="flex items-center space-x-3 mb-2">
          {product.price && (
            <>
              {discount > 0 && (
                <span className="text-gray-400 line-through text-sm">
                  PKR {product.price.toLocaleString()}
                </span>
              )}
              <span className="text-2xl font-bold text-blue-600">
                PKR {displayPrice.toLocaleString()}
              </span>
              {discount > 0 && (
                <span className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">
                  -{(discount * 100).toFixed(0)}%
                </span>
              )}
            </>
          )}
        </div>

        {/* 🚚 Delivery Charges */}
        <p className="text-sm text-gray-600 mb-4">
          Delivery Charges:{" "}
          {displayPrice < 599 ? (
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
        <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
            <h3 className="text-base font-semibold mb-2 text-gray-800">Product Description</h3>
            <div className="text-sm text-gray-700 space-y-1">
            {product.description
            .split("\n")
            .map((line: string) => line.trim()) // 👈 give type
            .filter(
                (line: string) =>
                line.length > 0 &&
                !/^product\s*code\s*:/i.test(line) &&
                !/^MZ\d+/i.test(line) &&
                !/PMGTIM/i.test(line)
            )
            .map((line: string, i: number) => { // 👈 also here
                // 🪄 Fix “1 3 cm” → “1-3 cm”
                line = line.replace(/1\s*3\s*cm/gi, "1-3 cm");

                const [label, ...rest] = line.split(":");
                const value = rest.join(":").trim();

                if (!value) {
                return (
                    <div key={i} className="text-gray-700">
                    {label}
                    </div>
                );
                }

                return (
                <div key={i}>
                    <span className="font-semibold">{label.trim()}:</span>
                    <span className="ml-1">{value}</span>
                </div>
                );
            })}

            </div>
        </div>
        )}
        </div>

        {(() => {
            if (!product.description) return null;

            const desc = product.description;

            // ✅ Match lines that *explicitly* mention Size or Sizes
            const sizeLineMatch = desc.match(/(?:Size|Sizes)\s*:\s*([^\n]+)/i);
            const colorLineMatch = desc.match(/(?:Color|Colors)\s*:\s*([^\n]+)/i);

            // Extract values if present
            const sizeList: string[] = sizeLineMatch
                ? sizeLineMatch[1]
                    .split(/[,/| ]+/)
                    .map((s: string) => s.trim())
                    .filter(Boolean)
                : [];

            const colorList: string[] = colorLineMatch
                ? colorLineMatch[1]
                    .split(/[,/| ]+/)
                    .map((c: string) => c.trim())
                    .filter(Boolean)
                : [];

            return (
                <>
                {/* ✅ Sizes Section */}
                {sizeList.length > 0 && (
                    <div className="mt-4">
                    <h3 className="font-medium mb-2">Sizes</h3>
                    <div className="flex flex-wrap gap-2">
                        {sizeList.map((s: string, index: number) => (
                        <button
                            key={index}
                            onClick={() => setSelectedSize(s)}
                            className={`px-3 py-1 rounded border ${
                            selectedSize === s
                                ? "bg-black text-white"
                                : "bg-white text-gray-700"
                            }`}
                        >
                            {s}
                        </button>
                        ))}
                    </div>
                    </div>
                )}

                {/* ✅ Colors Section */}
                {colorList.length > 0 && (
                    <div className="mt-4">
                    <h3 className="font-medium mb-2">Colors</h3>
                    <div className="flex flex-wrap gap-2">
                        {colorList.map((c: string, index: number) => (
                        <button
                            key={index}
                            onClick={() => setSelectedColor(c)}
                            className={`px-3 py-1 rounded border ${
                            selectedColor === c
                                ? "bg-black text-white"
                                : "bg-white text-gray-700"
                            }`}
                        >
                            {c}
                        </button>
                        ))}
                    </div>
                    </div>
                )}
                </>
            );
            })()}

         <br/>

        {/* 🎟️ Coupon Bar */}
        <div className="flex items-center space-x-2 mb-6">
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
        className="flex-1 border-2 border-blue-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
            onClick={applyCoupon}
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition"
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
          <button className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition">
            <ShoppingCart size={20} />
            <span>Add to Cart</span>
          </button>
          <button className="flex-1 flex items-center justify-center space-x-2 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition">
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
              {relatedProducts.slice(i * 10, i * 10 + 10).map((p) => (
                <a
                  key={p.id}
                  href={`/product/${p.id}`}
                  className="min-w-[140px] bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-100 p-2 transition"
                >
                  <img
                    src={p.image || "/placeholder.png"}
                    alt={p.title}
                    className="w-full h-24 object-cover rounded-lg mb-2"
                  />
                  <p className="text-sm font-medium line-clamp-2">{p.title}</p>
                  <p className="text-blue-600 text-sm font-semibold mt-1">
                    PKR {p.price?.toLocaleString()}
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
