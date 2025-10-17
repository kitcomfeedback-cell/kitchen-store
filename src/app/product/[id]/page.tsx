"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import catalogData from "../../data/catalog.json";
import {  } from "lucide-react";
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

  // ✅ Normalize product images to ensure all display
  const validImages =
    Array.isArray(product.images) && product.images.length > 0
      ? product.images.filter(
          (img: string) =>
            img &&
            !img.toLowerCase().includes("placeholder") &&
            !img.includes("markaz_logo_mobile") &&
            !img.endsWith(".svg")
        )
      : [];

  const images = [
    ...(validImages.length ? validImages : []),
    ...(product.image ? [product.image] : []),
  ].filter(
    (value, index, self) => value && self.indexOf(value) === index // remove duplicates
  );

  if (images.length === 0) images.push("/placeholder.png");


  // ⬇️ Replace your entire applyCoupon function with this one
  const applyCoupon = () => {
    const validCoupons: Record<string, number> = {
      SAVE20: 0.2,
    };

    if ((product.price || 0) < 599) {
      setCouponError("Coupons only apply for orders above Rs.599");
      setAppliedCoupon(null);
      return;
    }

    if (validCoupons[coupon.toUpperCase()]) {
      setAppliedCoupon(coupon.toUpperCase());
      setCouponError("");
    } else {
      setAppliedCoupon(null);
      setCouponError("Invalid coupon code");
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
      original_price: product.price || 0,
      coupon: appliedCoupon || null,
      discount_pct: discount * 100,
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

      {/* 🔍 Fullscreen Lightbox with Slider */}
      {showGallery && (
        <div
          className="fixed top-0 left-0 w-screen h-screen z-50 bg-black/90 flex flex-col items-center justify-start overflow-hidden"
          style={{ overscrollBehavior: "none" }}
        >
          {/* ❌ Close Button */}
          <button
            onClick={() => setShowGallery(false)}
            className="absolute top-6 right-6 text-white hover:text-red-400 transition"
          >
            <X size={36} />
          </button>

          {/* 🔄 Image Slider */}
          <div
            className="relative w-full max-w-3xl overflow-hidden flex items-start justify-center mt-55"
            {...swipeHandlers}
          >
            <div
              className="flex transition-transform duration-700 ease-in-out"
              style={{
                transform: `translateX(-${images.findIndex(img => img === selectedImage) * 100}%)`,
              }}
            >
              {images.map((img, i) => (
                <div
                  key={i}
                  className="w-full flex-shrink-0 flex items-center justify-center"
                >
                  <Image
                    src={img}
                    alt={`Product image ${i + 1}`}
                    width={900}
                    height={700}
                    className="object-contain max-h-[75vh] rounded-lg mt-0"
                  />

                </div>
              ))}
            </div>

            {/* ◀️ Prev */}
            <button
              onClick={() => {
                const current = images.findIndex((img) => img === selectedImage);
                const prev = (current - 1 + images.length) % images.length;
                setSelectedImage(images[prev]);
              }}
              className="absolute left-5 top-1/2 -translate-y-1/2 bg-black/50 text-white p-3 rounded-full hover:bg-black/70 transition"
            >
              ‹
            </button>

            {/* ▶️ Next */}
            <button
              onClick={() => {
                const current = images.findIndex((img) => img === selectedImage);
                const next = (current + 1) % images.length;
                setSelectedImage(images[next]);
              }}
              className="absolute right-5 top-1/2 -translate-y-1/2 bg-black/50 text-white p-3 rounded-full hover:bg-black/70 transition"
            >
              ›
            </button>
          </div>

          {/* ⚪ Dots */}
          <div className="flex space-x-3 mt-6">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setSelectedImage(img)}
                className={`w-3 h-3 rounded-full transition-all ${
                  img === selectedImage ? "bg-white scale-125" : "bg-gray-500"
                }`}
              ></button>
            ))}
          </div>
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
            <div className="text-sm text-gray-700 space-y-2">
              {product.description
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(line => 
                  line.length > 0 &&
                  !/^product\s*code\s*:/i.test(line) && // 🚫 remove "Product Code: ..."
                  !/^mz\d+/i.test(line) // 🚫 remove any line starting with MZ number
                )
                .map((line, i) => {
                  const isBullet =
                    /^\d+[\.\)]/.test(line) || // 1), 2. etc.
                    /^[•\-–]/.test(line) || // • or - or –
                    /:/.test(line); // looks like a feature

                  return isBullet ? (
                    <li key={i} className="list-disc list-inside">
                      {line.replace(/^[•\-–\d\.\)]+\s*/, "")}
                    </li>
                  ) : (
                    <p key={i}>{line}</p>
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
                {/* 🎨 Colors Section */}
                {(() => {
                  if (!product.description) return null;

                  // 🧩 Extract color line from description
                  const colorLineMatch = product.description.match(/(?:Color|Colors)\s*:\s*([^\n]+)/i);

                  const colorList: string[] = colorLineMatch
                    ? colorLineMatch[1]
                        .split(/[,/|]+/)
                        .map((c: string) => c.trim())
                        .filter(Boolean)
                    : [];

                  if (colorList.length === 0) return null;

                  // 🎨 Common color name to HEX map
                  const colorMap: Record<string, string> = {
                    red: "#FF0000",
                    blue: "#0000FF",
                    green: "#008000",
                    black: "#000000",
                    white: "#FFFFFF",
                    yellow: "#FFFF00",
                    pink: "#FFC0CB",
                    orange: "#FFA500",
                    purple: "#800080",
                    grey: "#808080",
                    gray: "#808080",
                    brown: "#8B4513",
                    beige: "#F5F5DC",
                    silver: "#C0C0C0",
                    gold: "#FFD700",
                  };

                  return (
                    <div className="mt-4">
                      <h3 className="font-medium mb-2">Available Colors</h3>
                      <div className="flex flex-wrap gap-3">
                        {colorList.map((c: string, index: number) => {
                          const colorKey = c.toLowerCase();
                          const colorValue = colorMap[colorKey] || "#ccc";

                          return (
                            <button
                              key={index}
                              onClick={() => setSelectedColor(c)}
                              className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition ${
                                selectedColor === c
                                  ? "border-blue-500 bg-blue-50"
                                  : "border-gray-300 bg-white"
                              }`}
                            >
                              {/* 🟢 Color Circle */}
                              <span
                                className="w-6 h-6 rounded-full border"
                                style={{
                                  backgroundColor: colorValue,
                                  borderColor:
                                    colorKey === "white" || colorKey === "yellow"
                                      ? "#ccc"
                                      : "transparent",
                                }}
                              />
                              {/* 🏷️ Color Name */}
                              <span className="text-sm font-medium capitalize text-gray-800">
                                {c}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
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
