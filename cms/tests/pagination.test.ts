import { describe, expect, it } from "vitest";
import { clampPage, getTotalPages, paginateItems } from "../src/shared/utils/pagination";
import { normalizeVietnamese } from "../src/shared/lib/search";

describe("cms/src/shared/utils/pagination", () => {
  const sample = [1, 2, 3, 4, 5, 6, 7];

  it("computes totalPages and clamps out-of-range pages", () => {
    expect(getTotalPages(0, 20)).toBe(1);
    expect(getTotalPages(25, 10)).toBe(3);
    expect(clampPage(0, 3)).toBe(1);
    expect(clampPage(99, 3)).toBe(3);
  });

  it("paginates items accurately and handles pageSize=0 (all)", () => {
    const p2 = paginateItems(sample, 2, 3);
    expect(p2.items).toEqual([4, 5, 6]);
    expect(p2.totalPages).toBe(3);
    expect(p2.hasNext).toBe(true);
    expect(p2.hasPrev).toBe(true);

    const all = paginateItems(sample, 1, 0);
    expect(all.items).toEqual(sample);
    expect(all.totalPages).toBe(1);
  });

  it("normalizes Vietnamese search text consistently", () => {
    expect(normalizeVietnamese("Áo Đá Bóng_Nike-2026")).toBe("ao da bong nike 2026");
  });
});
