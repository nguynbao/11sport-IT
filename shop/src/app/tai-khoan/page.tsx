import { Suspense } from "react";
import type { Metadata } from "next";
import { AccountClient } from "@/components/account/AccountClient";

export const metadata: Metadata = {
  title: "Tài khoản khách hàng",
  description: "Đăng nhập, quản lý đơn hàng và sổ địa chỉ 11Sport.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccountPage() {
  return (
    <div className="max-w-container mx-auto px-3.5 sm:px-4 lg:px-5 py-8 lg:py-10">
      <h1 className="sr-only">Tài khoản khách hàng 11Sport</h1>
      <Suspense fallback={<div className="h-64 bg-[#f8f9f5] animate-pulse" />}>
        <AccountClient />
      </Suspense>
    </div>
  );
}
