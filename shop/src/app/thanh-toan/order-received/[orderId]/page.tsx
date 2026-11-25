import { Suspense } from "react";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { BreadcrumbBar } from "@/components/store/StorefrontDesignSystem";
import { OrderSuccessClient } from "@/components/checkout/OrderSuccessClient";

interface OrderReceivedProps {
  params: { orderId: string };
}

export const metadata: Metadata = buildMetadata({
  title: "Đặt Hàng Thành Công",
  path: "/thanh-toan/order-received",
  noIndex: true,
});

export default function OrderReceivedByIdPage({ params }: OrderReceivedProps) {
  const orderCode = decodeURIComponent(params.orderId || "ONL-20261123-0001");

  return (
    <div className="max-w-container mx-auto px-3.5 sm:px-4 lg:px-5 py-8 lg:py-12 space-y-6">
      <BreadcrumbBar
        items={[
          { name: "Trang chủ", href: "/" },
          { name: "Thanh toán", href: "/thanh-toan" },
          { name: `Đơn hàng #${orderCode}` },
        ]}
      />

      <Suspense
        fallback={<div className="max-w-3xl mx-auto h-72 bg-[#f8f9f5] animate-pulse" />}
      >
        <OrderSuccessClient initialOrderCode={orderCode} />
      </Suspense>
    </div>
  );
}
