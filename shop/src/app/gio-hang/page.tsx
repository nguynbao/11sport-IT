import type { Metadata } from "next";
import { CartPageClient } from "@/components/cart/CartPageClient";

export const metadata: Metadata = {
  title: "Giỏ hàng",
  description: "Xem lại sản phẩm và tiến hành thanh toán tại 11Sport.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CartPage() {
  return (
    <div className="max-w-container mx-auto px-3.5 sm:px-4 lg:px-5 py-8 lg:py-10">
      <h1 className="sr-only">Giỏ hàng 11Sport</h1>
      <CartPageClient />
    </div>
  );
}
