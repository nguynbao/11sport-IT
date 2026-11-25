import { Suspense } from "react";
import type { Metadata } from "next";
import { OrderSuccessClient } from "@/components/checkout/OrderSuccessClient";

export const metadata: Metadata = {
  title: "Trạng thái đơn hàng",
  description: "Thông tin xác nhận và thanh toán đơn hàng tại 11Sport.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function OrderSuccessPage() {
  return (
    <div className="max-w-container mx-auto px-3.5 sm:px-4 lg:px-5 py-8 lg:py-12">
      <Suspense
        fallback={<div className="max-w-3xl mx-auto h-72 bg-[#f8f9f5] animate-pulse" />}
      >
        <OrderSuccessClient />
      </Suspense>
    </div>
  );
}
