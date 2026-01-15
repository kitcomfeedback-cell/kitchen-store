"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PrivacyAndTermsPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-10">

        {/* 🔙 Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-black mb-6"
        >
          <ArrowLeft size={24} className="text-black" />
        </button>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Privacy Policy & Terms and Conditions
        </h1>

        {/* Privacy Policy */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            Privacy Policy
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed">
            At <strong>Kitchenary</strong>, we respect your privacy and are
            committed to protecting your personal information. This policy
            explains how we collect, use, and safeguard your data.
          </p>

          <ul className="list-disc pl-5 space-y-2 text-gray-700">
            <li>
              We collect basic details such as name, phone number, address, and
              email for order processing and customer support.
            </li>
            <li>
              Your information is used only for communication, delivery, and
              service improvement.
            </li>
            <li>
              We do not sell, rent, or share your personal data with third
              parties except where required to fulfill orders.
            </li>
            <li>
              Reasonable security measures are applied to protect your data.
            </li>
          </ul>
        </section>

        <hr className="my-8" />

        {/* Terms & Conditions */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            Terms & Conditions
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed">
            By accessing or using the Kitchenary website or mobile application,
            you agree to the following terms and conditions.
          </p>

          <ul className="list-disc pl-5 space-y-2 text-gray-700">
            <li>
              All orders are subject to availability and confirmation.
            </li>
            <li>
              Prices and product availability may change without prior notice.
            </li>
            <li>
              Kitchenary reserves the right to cancel or refuse any order at its
              discretion.
            </li>
          </ul>
        </section>

        <hr className="my-8" />

        {/* Delivery Policy */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            Delivery Policy
          </h2>

          <ul className="list-disc pl-5 space-y-2 text-gray-700">
            <li>
              A <strong>fixed delivery charge of Rs. 100</strong> applies to
              orders below <strong>Rs. 599</strong>.
            </li>
            <li>
              Orders of <strong>Rs. 599 or above</strong> qualify for
              <strong> free delivery</strong>.
            </li>
            <li>
              Orders are delivered within <strong>5 working days</strong>.
            </li>
          </ul>
        </section>

        <hr className="my-8" />

        {/* Return Policy */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            Return & Refund Policy
          </h2>

          <ul className="list-disc pl-5 space-y-2 text-gray-700">
            <li>
              We offer a <strong>7-day easy return policy</strong> from the date
              of delivery.
            </li>
            <li>
              Items must be unused, undamaged, and returned in original
              packaging.
            </li>
            <li>
              Refunds are processed after inspection of the returned product.
            </li>
          </ul>
        </section>

        <hr className="my-8" />

        {/* Contact & Support */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            Contact & Support
          </h2>

          <p className="text-gray-700 mb-4">
            For questions, concerns, or support, please contact us:
          </p>

          <ul className="space-y-2 text-gray-700">
            <li>
              📧{" "}
              <a
                href="mailto:kitcom.feedback@gmail.com"
                className="text-blue-600 hover:underline"
              >
                kitcom.feedback@gmail.com
              </a>
            </li>
            <li>
              📧{" "}
              <a
                href="mailto:kitchenarypk@gmail.com"
                className="text-blue-600 hover:underline"
              >
                kitchenarypk@gmail.com
              </a>
            </li>
            <li>
              📞{" "}
              <a
                href="https://wa.me/923036789310"
                className="text-blue-600 hover:underline"
              >
                +92 303 6789310
              </a>
            </li>
          </ul>
        </section>

      </div>
    </main>
  );
}
