"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { FileText, ShoppingBag } from "lucide-react";
import { CatalogClient } from "@/components/catalog/CatalogClient";
import { ArticleGridCard } from "@/components/blog/ArticleViews";
import { QuickConsultForm } from "@/components/blog/QuickConsultForm";
import type {
  ArticleSummary,
  ProductFacets,
  ProductListItem,
} from "@/types/storefront";

interface SearchTabsClientProps {
  query: string;
  products: ProductListItem[];
  productMeta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  facets?: ProductFacets;
  articles: ArticleSummary[];
  articleTotal: number;
}

export function SearchTabsClient({
  query,
  products,
  productMeta,
  facets,
  articles,
  articleTotal,
}: SearchTabsClientProps) {
  const [activeTab, setActiveTab] = useState<"products" | "articles">(
    products.length === 0 && articles.length > 0 ? "articles" : "products"
  );

  return (
    <div className="space-y-6">
      {/* Sharp Tabs */}
      <div
        role="tablist"
        aria-label="Loại kết quả tìm kiếm"
        className="flex flex-wrap items-center justify-center sm:justify-start gap-2 border-b border-[#ececec] pb-3"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "products"}
          onClick={() => setActiveTab("products")}
          className={`inline-flex items-center gap-2 h-9 px-5 rounded-none border text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === "products"
              ? "bg-[#224e40] border-[#224e40] text-white"
              : "bg-white border-[#dddddd] text-[#555555] hover:border-[#224e40] hover:text-[#224e40]"
          }`}
        >
          <ShoppingBag className="w-4 h-4" aria-hidden="true" />
          <span>Sản phẩm ({productMeta.total})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "articles"}
          onClick={() => setActiveTab("articles")}
          className={`inline-flex items-center gap-2 h-9 px-5 rounded-none border text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === "articles"
              ? "bg-[#224e40] border-[#224e40] text-white"
              : "bg-white border-[#dddddd] text-[#555555] hover:border-[#224e40] hover:text-[#224e40]"
          }`}
        >
          <FileText className="w-4 h-4" aria-hidden="true" />
          <span>Bài viết ({articleTotal})</span>
        </button>
      </div>

      {activeTab === "products" ? (
        <Suspense
          fallback={<div className="h-96 bg-[#f8f9f5] animate-pulse" />}
        >
          <CatalogClient
            products={products}
            meta={productMeta}
            facets={facets}
          />
        </Suspense>
      ) : articles.length === 0 ? (
        <div className="border border-[#dce5da] bg-[#f8f9f5] py-14 px-4 text-center space-y-3">
          <p className="text-[16px] font-bold text-[#204b3e]">
            Không tìm thấy bài viết nào{" "}
            {query ? `cho từ khóa "${query}"` : ""}
          </p>
          <p className="text-[14px] text-[#555555]">
            Bạn có thể xem toàn bộ tin tức &amp; hướng dẫn chọn đồ tại chuyên mục
            Tin tức 11Sport.
          </p>
          <Link
            href="/tin-tuc"
            className="inline-flex items-center justify-center h-[39px] px-6 rounded-none bg-[#224e40] hover:bg-[#193b30] text-white text-xs font-bold uppercase tracking-wider"
          >
            XEM TẤT CẢ BÀI VIẾT
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
            {articles.map((article) => (
              <ArticleGridCard key={article._id} article={article} />
            ))}
          </div>

          <aside className="lg:col-span-3 lg:sticky lg:top-24">
            <QuickConsultForm variant="sidebar" sourceUrl="/tim-kiem" />
          </aside>
        </div>
      )}
    </div>
  );
}
