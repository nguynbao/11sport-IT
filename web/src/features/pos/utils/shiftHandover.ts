import type {
  DailyHandoverCategorySummary,
  DailyHandoverCheckData,
} from "@/shared/types";

export type CheckProduct = NonNullable<DailyHandoverCheckData["products"]>[number];

export interface UnitStat {
  unit: string;
  productCount: number;
  totalQty: number;
}

export function formatMoneyInput(val: number | string | undefined | null): string {
  if (val === 0 || val === "0") return "0";
  const digits = String(val ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "0";
  return Number(digits).toLocaleString("vi-VN");
}

export function parseMoneyInput(raw: string): number {
  const digits = String(raw || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return 0;
  return Number(digits) || 0;
}

export function computeShiftTiming(
  shiftCode: "SHIFT_1" | "SHIFT_2" | "BOTH",
  canConfirmCheckout: boolean | undefined,
  shiftEndLabel: string | undefined
) {
  const now = new Date();
  const totalMinutesNow = now.getHours() * 60 + now.getMinutes();
  const isEnd21 = shiftCode === "SHIFT_2" || shiftCode === "BOTH";
  const shiftEndMinutes = isEnd21 ? 21 * 60 : 17 * 60 + 30;
  const effectiveEndLabel = shiftEndLabel || (isEnd21 ? "21:00" : "17:30");
  const isReachedCheckoutTime =
    typeof canConfirmCheckout === "boolean"
      ? canConfirmCheckout
      : totalMinutesNow >= shiftEndMinutes;
  const diffLateMinutes = Math.max(0, totalMinutesNow - shiftEndMinutes);
  const isLateSubmit =
    isReachedCheckoutTime && shiftCode !== "BOTH" && diffLateMinutes > 5;
  return { effectiveEndLabel, isReachedCheckoutTime, diffLateMinutes, isLateSubmit };
}

export function buildFallbackSummaries(
  data: DailyHandoverCheckData
): DailyHandoverCategorySummary[] {
  const prods = Array.isArray(data.products) ? data.products : [];
  const cats = Array.isArray(data.checkedCategories) ? data.checkedCategories : ["Vợt"];
  return cats.map((catName, idx) => {
    const matching = prods.filter((p) => p.categoryName === catName);
    const expectedTotalQty = matching.reduce(
      (sum, p) => sum + (Number(p.stockQtyFloor1) || 0),
      0
    );
    return {
      categoryId: catName,
      categoryCode: catName.toUpperCase(),
      categoryName: catName,
      isPrimaryCategory: idx === 0,
      unit:
        new Set(matching.map((p) => p.unit || "Cái")).size > 1
          ? "Sản phẩm"
          : matching[0]?.unit || "Cái",
      productCount: matching.length,
      expectedTotalQty,
    };
  });
}

export function computeUnitStats(
  products: CheckProduct[],
  selectedCategoryFilter: string
): UnitStat[] {
  const map = new Map<string, UnitStat>();
  for (const p of products) {
    if (
      selectedCategoryFilter !== "ALL" &&
      String(p.categoryName || "").trim() !== selectedCategoryFilter
    ) {
      continue;
    }
    const u = String(p.unit || "Cái").trim() || "Cái";
    const cur = map.get(u) || { unit: u, productCount: 0, totalQty: 0 };
    cur.productCount += 1;
    cur.totalQty += Number(p.stockQtyFloor1) || 0;
    map.set(u, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
}

export function computeUnitBreakdownByCategory(products: CheckProduct[]) {
  const res = new Map<string, Array<{ unit: string; totalQty: number }>>();
  for (const p of products) {
    const cat = String(p.categoryName || "").trim();
    const u = String(p.unit || "Cái").trim() || "Cái";
    if (!cat) continue;
    const list = res.get(cat) || [];
    const found = list.find((x) => x.unit === u);
    const qty = Number(p.stockQtyFloor1) || 0;
    if (found) {
      found.totalQty += qty;
    } else {
      list.push({ unit: u, totalQty: qty });
    }
    res.set(cat, list);
  }
  return res;
}

export function filterCheckProducts(
  products: CheckProduct[],
  selectedCategoryFilter: string,
  selectedUnitFilter: string,
  productSearch: string
): CheckProduct[] {
  const q = productSearch.trim().toLowerCase();
  return products.filter((p) => {
    if (
      selectedCategoryFilter !== "ALL" &&
      String(p.categoryName || "").trim() !== selectedCategoryFilter
    ) {
      return false;
    }
    if (selectedUnitFilter !== "ALL") {
      const u = String(p.unit || "Cái").trim() || "Cái";
      if (u !== selectedUnitFilter) return false;
    }
    if (q) {
      const matchName = String(p.name || "").toLowerCase().includes(q);
      const matchCode = String(p.code || "").toLowerCase().includes(q);
      if (!matchName && !matchCode) return false;
    }
    return true;
  });
}
