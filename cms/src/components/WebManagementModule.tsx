"use client";

import React, { useState, useCallback } from "react";
import { apiRequest, StaffUser } from "@/lib/api";
import WebDashboardTab from "./web/WebDashboardTab";
import WebHomeSectionsTab from "./web/WebHomeSectionsTab";
import WebBannersTab from "./web/WebBannersTab";
import WebMenusTab from "./web/WebMenusTab";
import WebCatalogTab from "./web/WebCatalogTab";
import WebContentTab from "./web/WebContentTab";
import WebPromotionsTab from "./web/WebPromotionsTab";
import WebReviewsTab from "./web/WebReviewsTab";
import WebSeoRedirectTab from "./web/WebSeoRedirectTab";
import WebSettingsTab from "./web/WebSettingsTab";
import WebOrdersTab from "./web/WebOrdersTab";
import WebAuditLogsTab from "./web/WebAuditLogsTab";
import {
  BarChart3,
  LayoutTemplate,
  Package,
  Megaphone,
  Settings,
  ShoppingBag,
  RefreshCw,
  Globe,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

type PrimaryNavId = "dashboard" | "orders" | "appearance" | "catalog" | "marketing" | "system";
type AppearanceSubId = "banners" | "home-sections" | "menus";
type MarketingSubId = "content" | "promotions" | "reviews";
type SystemSubId = "settings" | "seo-redirect" | "audit-logs";

interface NavItemDef {
  id: PrimaryNavId;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PRIMARY_NAV: NavItemDef[] = [
  {
    id: "dashboard",
    label: "Tổng quan",
    desc: "Doanh thu Online, đơn hàng & đánh giá chờ duyệt",
    icon: BarChart3,
  },
  {
    id: "orders",
    label: "Đơn hàng Online",
    desc: "Xử lý đơn đặt từ Website & mã vận đơn",
    icon: ShoppingBag,
  },
  {
    id: "appearance",
    label: "Giao diện & Menu",
    desc: "Banner trang chủ, sắp xếp khối & Mega Menu",
    icon: LayoutTemplate,
  },
  {
    id: "catalog",
    label: "Sản phẩm & Danh mục",
    desc: "Bật/tắt hiển thị web, ảnh, giá & thương hiệu",
    icon: Package,
  },
  {
    id: "marketing",
    label: "Tin tức & Khuyến mãi",
    desc: "Bài viết blog, trang chính sách, mã giảm giá & đánh giá",
    icon: Megaphone,
  },
  {
    id: "system",
    label: "Cài đặt & Hệ thống",
    desc: "Thông tin shop, SEO 301 Redirect & nhật ký thao tác",
    icon: Settings,
  },
];

export default function WebManagementModule({ currentUser }: { currentUser: StaffUser }) {
  const [activeNav, setActiveNav] = useState<PrimaryNavId>("dashboard");
  const [appearanceSub, setAppearanceSub] = useState<AppearanceSubId>("banners");
  const [marketingSub, setMarketingSub] = useState<MarketingSubId>("content");
  const [systemSub, setSystemSub] = useState<SystemSubId>("settings");

  const [revalidating, setRevalidating] = useState(false);
  const [revalMsg, setRevalMsg] = useState<{ type: "ok" | "warn"; text: string } | null>(null);

  const isAllowed = currentUser.role === "ADMIN" || currentUser.role === "CEO";

  const handleJump = useCallback((target: string) => {
    if (target === "dashboard" || target === "orders" || target === "catalog") {
      setActiveNav(target);
      return;
    }
    if (target === "banners" || target === "home-sections" || target === "menus") {
      setActiveNav("appearance");
      setAppearanceSub(target);
      return;
    }
    if (target === "content" || target === "promotions" || target === "reviews") {
      setActiveNav("marketing");
      setMarketingSub(target);
      return;
    }
    if (target === "settings" || target === "seo-redirect" || target === "audit-logs") {
      setActiveNav("system");
      setSystemSub(target);
    }
  }, []);

  const handleRevalidate = useCallback(async () => {
    setRevalidating(true);
    setRevalMsg(null);
    try {
      const res = await apiRequest<{
        serverCacheCleared: boolean;
        shopNotified: boolean;
        shopError?: string;
      }>("/cms/web/revalidate", {
        method: "POST",
        body: JSON.stringify({ paths: ["/", "/tin-tuc"], tags: ["home", "menu"] }),
      });
      if (res.data?.shopNotified) {
        setRevalMsg({ type: "ok", text: "Đã làm mới cache & đồng bộ lên Website!" });
      } else {
        setRevalMsg({
          type: "ok",
          text: res.data?.shopError
            ? `Đã xóa cache Server (${res.data.shopError})`
            : "Đã xóa cache Server thành công!",
        });
      }
    } catch (e: any) {
      setRevalMsg({ type: "warn", text: e?.message || "Không thể làm mới cache Website" });
    } finally {
      setRevalidating(false);
    }
  }, []);

  if (!isAllowed) {
    return (
      <div className="p-8 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-3">
        <ShieldAlert className="w-6 h-6 shrink-0" />
        <div>
          <h1 className="font-extrabold text-base">Không có quyền truy cập</h1>
          <p className="text-xs mt-0.5">
            Phân hệ Quản lý Website chỉ dành cho vai trò ADMIN và CEO.
          </p>
        </div>
      </div>
    );
  }

  const activeDef = PRIMARY_NAV.find((t) => t.id === activeNav) || PRIMARY_NAV[0];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm sm:text-base text-slate-900">
                Quản lý Website — {activeDef.label}
              </h1>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-teal-600 text-white font-bold">
                {currentUser.role}
              </span>
            </div>
            <p className="text-xs text-slate-500">{activeDef.desc}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRevalidate}
          disabled={revalidating}
          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${revalidating ? "animate-spin" : ""}`} />
          <span>{revalidating ? "Đang đồng bộ..." : "Đồng bộ Website"}</span>
        </button>
      </div>

      {revalMsg && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            revalMsg.type === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
        >
          {revalMsg.type === "ok" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{revalMsg.text}</span>
        </div>
      )}

      <div className="lg:hidden">
        <select
          value={activeNav}
          onChange={(e) => setActiveNav(e.target.value as PrimaryNavId)}
          className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-900"
        >
          {PRIMARY_NAV.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <aside className="hidden lg:block w-56 shrink-0 bg-white rounded-2xl border border-slate-200 p-2.5 space-y-1 sticky top-20">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveNav(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition cursor-pointer ${
                  active
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-slate-700 hover:bg-teal-50 hover:text-teal-800"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? "text-white" : "text-teal-600"}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </aside>

        <section className="flex-1 min-w-0 w-full bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
          {activeNav === "dashboard" && <WebDashboardTab onJumpTab={handleJump} />}
          {activeNav === "orders" && <WebOrdersTab />}

          {activeNav === "appearance" && (
            <>
              <SubPillBar
                items={[
                  { id: "banners", label: "Banner & Slider" },
                  { id: "home-sections", label: "Bố cục trang chủ" },
                  { id: "menus", label: "Mega Menu" },
                ]}
                activeId={appearanceSub}
                onSelect={(id) => setAppearanceSub(id as AppearanceSubId)}
              />
              {appearanceSub === "banners" && <WebBannersTab />}
              {appearanceSub === "home-sections" && (
                <WebHomeSectionsTab onRevalidate={handleRevalidate} />
              )}
              {appearanceSub === "menus" && <WebMenusTab />}
            </>
          )}

          {activeNav === "catalog" && <WebCatalogTab />}

          {activeNav === "marketing" && (
            <>
              <SubPillBar
                items={[
                  { id: "content", label: "Bài viết & Trang chính sách" },
                  { id: "promotions", label: "Khuyến mãi Online" },
                  { id: "reviews", label: "Duyệt Đánh giá" },
                ]}
                activeId={marketingSub}
                onSelect={(id) => setMarketingSub(id as MarketingSubId)}
              />
              {marketingSub === "content" && <WebContentTab />}
              {marketingSub === "promotions" && <WebPromotionsTab />}
              {marketingSub === "reviews" && <WebReviewsTab />}
            </>
          )}

          {activeNav === "system" && (
            <>
              <SubPillBar
                items={[
                  { id: "settings", label: "Cài đặt Website" },
                  { id: "seo-redirect", label: "SEO & 301 Redirect" },
                  { id: "audit-logs", label: "Nhật ký thao tác" },
                ]}
                activeId={systemSub}
                onSelect={(id) => setSystemSub(id as SystemSubId)}
              />
              {systemSub === "settings" && <WebSettingsTab role={currentUser.role} />}
              {systemSub === "seo-redirect" && <WebSeoRedirectTab role={currentUser.role} />}
              {systemSub === "audit-logs" && <WebAuditLogsTab />}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function SubPillBar({
  items,
  activeId,
  onSelect,
}: {
  items: { id: string; label: string }[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              active
                ? "bg-teal-600 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-700"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
