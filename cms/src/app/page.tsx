"use client";

import React, { useState, useEffect } from "react";
import {
  StaffUser,
  Order,
  apiRequest,
  getStoredUser,
  setStoredAuth,
} from "@/lib/api";
import InventoryModule from "@/components/InventoryModule";
import CategoryModule from "@/components/CategoryModule";
import OrdersReturnsModule from "@/components/OrdersReturnsModule";
import StaffModule from "@/components/StaffModule";
import InvoicePdfModal from "@/components/InvoicePdfModal";
import {
  Boxes,
  FolderKanban,
  ShoppingBag,
  Users,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";

type CmsModuleType = "INVENTORY" | "CATEGORIES" | "ORDERS" | "STAFF";

export default function CmsDashboardPage() {
  const [activeModule, setActiveModule] = useState<CmsModuleType>("INVENTORY");
  const [adminUser, setAdminUser] = useState<StaffUser | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);

  useEffect(() => {
    const saved = getStoredUser();
    if (saved) {
      setAdminUser(saved);
    } else {
      apiRequest<{ token: string; user: StaffUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "admin", password: "admin123" }),
      })
        .then((res) => {
          if (res.data?.token && res.data?.user) {
            setStoredAuth(res.data.token, res.data.user);
            setAdminUser(res.data.user);
          }
        })
        .catch(() => {
          const fallback: StaffUser = {
            _id: "admin",
            code: "NV_ADMIN",
            username: "admin",
            fullName: "Quản Lý 11Sport (Admin)",
            role: "ADMIN",
            status: "ACTIVE",
          };
          setStoredAuth("demo-admin-token", fallback);
          setAdminUser(fallback);
        });
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Header CMS */}
      <header className="bg-slate-900 text-white shadow-lg print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center font-black text-lg">
              CMS
            </div>
            <div>
              <div className="font-extrabold text-base flex items-center gap-2">
                11SPORT ADMIN CMS
                <span className="text-[11px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">
                  Port 3001
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Quản trị Tồn kho Đầu kỳ/Cuối kỳ, Giá bán, Category, Đơn hàng & Nhân sự
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">Quản trị viên:</span>
              <strong className="text-white">
                {adminUser?.fullName || "Admin 11Sport"}
              </strong>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold">
                {adminUser?.role || "ADMIN"}
              </span>
            </div>

            <a
              href={process.env.NEXT_PUBLIC_WEB_URL || "https://11sport-it.vercel.app"}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-400 border border-slate-700 flex items-center gap-1"
            >
              Mở Web POS & Kho <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Navigation 4 Module chính của CMS */}
        <div className="bg-slate-800/90 border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 flex items-center gap-1.5 overflow-x-auto py-1.5">
            <button
              type="button"
              onClick={() => setActiveModule("INVENTORY")}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition ${
                activeModule === "INVENTORY"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
              }`}
            >
              <Boxes className="w-4 h-4" />
              1. Quản lý Kho, Giá bán & Sổ kho
            </button>

            <button
              type="button"
              onClick={() => setActiveModule("CATEGORIES")}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition ${
                activeModule === "CATEGORIES"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
              }`}
            >
              <FolderKanban className="w-4 h-4" />
              2. Quản lý Category (Danh mục)
            </button>

            <button
              type="button"
              onClick={() => setActiveModule("ORDERS")}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition ${
                activeModule === "ORDERS"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              3. Quản lý Đơn hàng & Trả/Đổi
            </button>

            <button
              type="button"
              onClick={() => setActiveModule("STAFF")}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition ${
                activeModule === "STAFF"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
              }`}
            >
              <Users className="w-4 h-4" />
              4. Quản lý Nhân viên & Phân quyền
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 print:p-0">
        {activeModule === "INVENTORY" && <InventoryModule />}
        {activeModule === "CATEGORIES" && <CategoryModule />}
        {activeModule === "ORDERS" && (
          <OrdersReturnsModule onOpenInvoice={(ord) => setInvoiceOrder(ord)} />
        )}
        {activeModule === "STAFF" && <StaffModule />}
      </main>

      {/* Modal In Hóa Đơn PDF (K80 / A4) */}
      <InvoicePdfModal
        order={invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
      />
    </div>
  );
}
