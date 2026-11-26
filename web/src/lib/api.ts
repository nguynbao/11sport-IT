/**
 * Re-export tạm thời trong giai đoạn refactor P1-P4 để giữ tương thích cho các file chưa di chuyển.
 * Sẽ xoá ở P5 sau khi mọi import đã chuyển sang `@/shared/*` và `@/features/*`.
 */
export * from "@/shared/types";
export * from "@/shared/api/client";
export * from "@/shared/api/errors";
export * from "@/shared/api/catalogLookup";
export * from "@/shared/utils/format";
export * from "@/shared/utils/productCode";
export * from "@/shared/lib/search";
export * from "@/features/attendance/api";
export * from "@/features/pos/api";
export * from "@/features/leave/api";
