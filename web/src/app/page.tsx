"use client";

import React, { useState, useEffect } from "react";
import {
  StaffUser,
  Order,
  apiRequest,
  getStoredUser,
  setStoredAuth,
} from "@/lib/api";
import PosTab from "@/components/PosTab";
import InventoryTab from "@/components/InventoryTab";
import ImportTab from "@/components/ImportTab";
import CustomerTab from "@/components/CustomerTab";
import ReturnExchangeTab from "@/components/ReturnExchangeTab";
import InvoicePdfModal from "@/components/InvoicePdfModal";
import {
  ShoppingCart,
  Package,
  ClipboardCheck,
  Users,
  RotateCcw,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";

type TabType = "POS" | "INVENTORY" | "IMPORT" | "CUSTOMER" | "RETURN";

const DEMO_ACCOUNTS = [
  {
    username: "sales1",
    password: "123456",
    label: "Nhân viên bán hàng (SALES)",
    role: "SALES",
  },
  {
    username: "warehouse1",
    password: "123456",
    label: "Thủ kho (WAREHOUSE)",
    role: "WAREHOUSE",
  },
  {
    username: "admin",
    password: "admin123",
    label: "Quản lý / Admin (ADMIN)",
    role: "ADMIN",
  },
];

export default function WebPosHomePage() {
  const [activeTab, setActiveTab] = useState<TabType>("POS");
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [switchingRole, setSwitchingRole] = useState(false);

  const handleQuickLogin = async (username: string, password = "123456") => {
    setSwitchingRole(true);
    try {
      const res = await apiRequest<{ token: string; user: StaffUser }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ username, password }),
        }
      );
      if (res.data?.token && res.data?.user) {
        setStoredAuth(res.data.token, res.data.user);
        setCurrentUser(res.data.user);
        if (res.data.user.role === "WAREHOUSE" && activeTab === "POS") {
          setActiveTab("IMPORT");
        } else if (res.data.user.role === "SALES" && activeTab === "IMPORT") {
          setActiveTab("POS");
        }
      }
    } catch {
      // Fallback user cho trường hợp chưa seed
      const fallbackUser: StaffUser = {
        _id: username,
        code: username.toUpperCase(),
        username,
        fullName:
          username === "sales1"
            ? "Nguyễn Văn Bán (Sales)"
            : username === "warehouse1"
            ? "Lê Văn Kho (Thủ kho)"
            : "Quản Lý 11Sport (Admin)",
        role:
          username === "sales1"
            ? "SALES"
            : username === "warehouse1"
            ? "WAREHOUSE"
            : "ADMIN",
        status: "ACTIVE",
      };
      setStoredAuth("demo-token", fallbackUser);
      setCurrentUser(fallbackUser);
    } finally {
      setSwitchingRole(false);
    }
  };

  useEffect(() => {
    const saved = getStoredUser();
    if (saved) {
      setCurrentUser(saved);
    } else {
      handleQuickLogin("sales1", "123456");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Header thương hiệu 11Sport & Chuyển nhanh vai trò */}
      <header className="bg-slate-900 text-white shadow-lg print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center font-black text-lg tracking-tighter">
              11S
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight flex items-center gap-2">
                11SPORT POS & KHO VẬN
                <span className="text-[11px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">
                  v1.0
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Hệ thống Bán hàng, Xuất PDF (K80/A4), Camera OCR Kiểm kho & Đổi trả
              </div>
            </div>
          </div>

          {/* Chuyển đổi nhanh vai trò nhân viên để kiểm thử phân quyền */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <div className="text-xs">
                <span className="text-slate-400">Đang trực: </span>
                <strong className="text-white">
                  {currentUser?.fullName || "Nhân viên"}
                </strong>{" "}
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold ml-1">
                  {currentUser?.role || "SALES"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
              {DEMO_ACCOUNTS.map((acc) => {
                const isActive = currentUser?.username === acc.username;
                return (
                  <button
                    key={acc.username}
                    type="button"
                    disabled={switchingRole}
                    onClick={() => handleQuickLogin(acc.username, acc.password)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      isActive
                        ? "bg-emerald-600 text-white shadow"
                        : "text-slate-300 hover:text-white hover:bg-slate-700"
                    }`}
                  >
                    {acc.role === "SALES"
                      ? "NV Bán hàng"
                      : acc.role === "WAREHOUSE"
                      ? "Thủ kho"
                      : "Quản lý"}
                  </button>
                );
              })}
            </div>

            <a
              href={process.env.NEXT_PUBLIC_CMS_URL || "https://11sport-it-m1ei.vercel.app"}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-400 border border-slate-700 flex items-center gap-1"
            >
              Mở CMS <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Thanh 5 Tab chức năng */}
        <div className="bg-slate-800/90 border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 overflow-x-auto py-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("POS")}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition ${
                activeTab === "POS"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              1. Bán hàng (POS)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("INVENTORY")}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition ${
                activeTab === "INVENTORY"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
              }`}
            >
              <Package className="w-4 h-4" />
              2. Kho hàng (Tồn kho)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("IMPORT")}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition ${
                activeTab === "IMPORT"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              3. Nhập kho (7 Bước & Camera OCR)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("CUSTOMER")}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition ${
                activeTab === "CUSTOMER"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
              }`}
            >
              <Users className="w-4 h-4" />
              4. Tra cứu Khách & Xuất PDF
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("RETURN")}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition ${
                activeTab === "RETURN"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              5. Trả / Đổi hàng
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 print:p-0">
        {activeTab === "POS" && (
          <PosTab onOpenInvoice={(ord) => setInvoiceOrder(ord)} />
        )}
        {activeTab === "INVENTORY" && <InventoryTab />}
        {activeTab === "IMPORT" && <ImportTab />}
        {activeTab === "CUSTOMER" && (
          <CustomerTab onOpenInvoice={(ord) => setInvoiceOrder(ord)} />
        )}
        {activeTab === "RETURN" && <ReturnExchangeTab />}
      </main>

      {/* Modal Xuất / In Hóa Đơn PDF (K80 / A4) */}
      <InvoicePdfModal
        order={invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
      />
    </div>
  );
}
