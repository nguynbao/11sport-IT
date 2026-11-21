"use client";

import React, { useEffect, useState } from "react";
import { FolderKanban, Tags, Package, Sparkles, ArrowRight, Layers } from "lucide-react";
import { Brand, Category, Product, apiRequest, fetchBrandsApi } from "@/lib/api";
import CategoryModule from "./CategoryModule";
import BrandModule from "./BrandModule";
import ProductCatalogModule from "./ProductCatalogModule";

type SubTab = "CATEGORY" | "BRAND" | "PRODUCT_CATALOG";

/** Tab "Danh mục, Thương hiệu & Sản phẩm" (R7) — 3 tab con: Danh mục / Thương hiệu / Quản lý Sản phẩm. */
export default function CategoryBrandModule() {
  const [tab, setTab] = useState<SubTab>("PRODUCT_CATALOG");
  const [counts, setCounts] = useState<{
    categories: number;
    activeCategories: number;
    brands: number;
    activeBrands: number;
    products: number;
    variants: number;
  }>({
    categories: 0,
    activeCategories: 0,
    brands: 0,
    activeBrands: 0,
    products: 0,
    variants: 0,
  });

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiRequest<Category[]>("/categories").catch(() => ({ data: [] as Category[] })),
      fetchBrandsApi().catch(() => [] as Brand[]),
      apiRequest<Product[]>("/products").catch(() => ({ data: [] as Product[] })),
    ]).then(([cRes, bList, pRes]) => {
      if (!mounted) return;
      const cats = Array.isArray(cRes.data) ? cRes.data : [];
      const prods = Array.isArray(pRes.data) ? pRes.data : [];
      const totalVars = prods.reduce(
        (sum, p) => sum + (Array.isArray(p.variants) ? p.variants.filter((v) => v.color || v.size).length : 0),
        0
      );
      setCounts({
        categories: cats.length,
        activeCategories: cats.filter((c) => c.status === "ACTIVE").length,
        brands: bList.length,
        activeBrands: bList.filter((b) => b.status === "ACTIVE").length,
        products: prods.length,
        variants: totalVars,
      });
    });
    return () => {
      mounted = false;
    };
  }, [tab]);

  const tabs: {
    id: SubTab;
    step: string;
    label: string;
    sublabel: string;
    badge: string;
    icon: React.ElementType;
  }[] = [
    {
      id: "CATEGORY",
      step: "Bước 1",
      label: "Danh mục (Category)",
      sublabel: "Mã Cate 1–3 ký tự mở đầu SKU",
      badge: `${counts.activeCategories}/${counts.categories}`,
      icon: FolderKanban,
    },
    {
      id: "BRAND",
      step: "Bước 2",
      label: "Thương hiệu (Brand)",
      sublabel: "Mã hãng 2–4 ký tự gắn theo Cate",
      badge: `${counts.activeBrands}/${counts.brands}`,
      icon: Tags,
    },
    {
      id: "PRODUCT_CATALOG",
      step: "Bước 3",
      label: "Sản phẩm & Biến thể",
      sublabel: "Mã gốc, Màu/Size, Giá & Ghi chú",
      badge: `${counts.products} SP · ${counts.variants} mã con`,
      icon: Package,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header tổng quan + điều hướng 3 phân hệ theo quy chuẩn v5.0 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-teal-400 flex items-center justify-center shrink-0 shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight">
                   Trung tâm Danh mục, Thương hiệu &amp; Sản phẩm
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-mono text-[11px] font-bold">
                  Chuẩn SKU v5.0
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Quy trình chuẩn hoá mã tự động:{" "}
                <strong className="font-mono text-slate-700">[CATE]</strong>
                <ArrowRight className="w-3 h-3 inline mx-1 text-slate-400" />
                <strong className="font-mono text-slate-700">[BRAND]</strong>
                <ArrowRight className="w-3 h-3 inline mx-1 text-slate-400" />
                <strong className="font-mono text-slate-700">[VERSION]</strong>
                <ArrowRight className="w-3 h-3 inline mx-1 text-slate-400" />
                <strong className="font-mono text-indigo-700">[MÀU + SIZE]</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>Tổng quan:</span>
              <strong className="font-mono text-slate-900">{counts.categories}</strong> Danh mục ·{" "}
              <strong className="font-mono text-slate-900">{counts.brands}</strong> Thương hiệu ·{" "}
              <strong className="font-mono text-teal-700">{counts.products}</strong> Sản phẩm
            </div>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Danh mục, Thương hiệu & Sản phẩm"
          className="grid grid-cols-1 md:grid-cols-3 gap-2.5"
        >
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`group text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  active
                    ? "bg-teal-600 text-white border-slate-900 shadow-md"
                    : "bg-slate-50/70 hover:bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition ${
                      active
                        ? "bg-teal-500 text-slate-950"
                        : "bg-white border border-slate-200 text-slate-700 group-hover:border-slate-300"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wider ${
                          active ? "text-teal-400" : "text-slate-400"
                        }`}
                      >
                        {t.step}
                      </span>
                    </div>
                    <div className="font-extrabold text-xs sm:text-sm truncate">{t.label}</div>
                    <div
                      className={`text-[11px] truncate ${
                        active ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {t.sublabel}
                    </div>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full font-mono text-[11px] font-extrabold shrink-0 ${
                    active
                      ? "bg-white/15 text-white"
                      : "bg-white border border-slate-200 text-slate-700"
                  }`}
                >
                  {t.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {tab === "CATEGORY" && <CategoryModule />}
      {tab === "BRAND" && <BrandModule />}
      {tab === "PRODUCT_CATALOG" && <ProductCatalogModule />}
    </div>
  );
}
