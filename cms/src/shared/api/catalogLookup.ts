import { apiRequest } from "./client";
import type { Brand, PreviewCodeResult, Product, ProductLookupResult } from "@/shared/types";

export async function fetchBrandsApi(
  params: { categoryId?: string; status?: "ACTIVE" | "INACTIVE"; search?: string } = {}
): Promise<Brand[]> {
  const qs = new URLSearchParams();
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  if (params.status) qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);
  const q = qs.toString();
  const res = await apiRequest<Brand[]>(`/brands${q ? `?${q}` : ""}`);
  return Array.isArray(res.data) ? res.data : [];
}

export async function previewProductCodeApi(body: {
  categoryId: string;
  brandId: string;
  versionName: string;
  versionCode?: string;
  variants?: { color: string; colorCode?: string; size: string }[];
}): Promise<PreviewCodeResult> {
  const res = await apiRequest<PreviewCodeResult>("/products/preview-code", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function addProductVariantsApi(
  productId: string,
  variants: {
    color: string;
    colorCode?: string;
    size: string;
    sellingPrice?: number;
    costPrice?: number;
    colorHexes?: string[];
  }[]
): Promise<Product> {
  const res = await apiRequest<Product>(`/products/${productId}/variants`, {
    method: "POST",
    body: JSON.stringify({ variants }),
  });
  return res.data;
}

export async function lookupProductByCodeApi(code: string): Promise<ProductLookupResult | null> {
  const c = String(code || "").trim();
  if (!c) return null;
  try {
    const res = await apiRequest<ProductLookupResult>(`/products/lookup?code=${encodeURIComponent(c)}`);
    return res.data || null;
  } catch (err: any) {
    if (err?.code === "PRODUCT_NOT_FOUND") return null;
    throw err;
  }
}
