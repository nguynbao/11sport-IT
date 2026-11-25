import type React from "react";
import { apiRequest, getStoredUser } from "@/shared/api/client";
import type { AdminImportRow } from "../types";
import type { InventoryState } from "./useInventoryState";
import { API_ENDPOINTS } from "@/shared/api/endpoints";

export async function parseAndApplyAdminImportFile(
  e: React.ChangeEvent<HTMLInputElement>,
  state: InventoryState
) {
  const {
    categories,
    newProdCatId,
    adminFileImportMode,
    adminImportNote,
    setImportingAdminFile,
    setStatusMsg,
    setAdminImportRows,
    setAdminImportNote,
  } = state;


    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImportingAdminFile(true);
    setStatusMsg(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = String(reader.result || "");
          const commaIdx = res.indexOf(",");
          resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
        };
        reader.onerror = () => reject(new Error("Không thể đọc file đã chọn"));
        reader.readAsDataURL(file);
      });

      const res = await apiRequest<{
        fileType: string;
        items: any[];
        totalRows: number;
        totalQuantity: number;
      }>(API_ENDPOINTS.IMPORTS.PARSE_FILE, {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          contentBase64: base64,
          defaultCategoryId: newProdCatId || categories[0]?._id || undefined,
        }),
      });

      const parsedItems = Array.isArray(res.data?.items) ? res.data.items : [];
      if (parsedItems.length === 0) {
        alert(
          `Không tìm thấy dòng sản phẩm hợp lệ trong file "${file.name}". Vui lòng kiểm tra cột Tên sản phẩm / Số lượng hoặc tải File Mẫu.`
        );
        return;
      }

      const defaultCat = categories.find((c) => c._id === String(newProdCatId || categories[0]?._id));
      const mappedRows: AdminImportRow[] = parsedItems.map((it: any, idx: number) => {
        const catId = String(it.categoryId || defaultCat?._id || "");
        return {
          stt: idx + 1,
          // v5.0: mã do server đề xuất/khớp khi parse file — client không tự sinh
          productId: it.productId ? String(it.productId) : undefined,
          productCode: String(it.productCode || ""),
          colorCode: it.colorCode ? String(it.colorCode) : undefined,
          productName: it.productName || "",
          categoryId: catId,
          brand: it.brand || "",
          color: it.color || "",
          size: String(it.size || "").toUpperCase(),
          unit: it.unit || "Cái",
          quantity: Math.max(1, Number(it.actualQuantity ?? it.expectedQuantity ?? 1)),
          costPrice: Number(it.costPrice || 0),
          sellingPrice: Number(it.sellingPrice || 0),
          note: it.note || "",
          isConfirmed: false,
        };
      });

      setAdminImportRows((prev) => {
        const existingValid = prev.filter((r) => r.productName.trim() !== "");
        const combined =
          adminFileImportMode === "append" && existingValid.length > 0
            ? [...existingValid, ...mappedRows]
            : mappedRows;
        return combined.map((r, idx) => ({ ...r, stt: idx + 1 }));
      });

      if (!adminImportNote.trim()) {
        const actorLabel = getStoredUser()?.fullName || "Nhân sự kho";
        setAdminImportNote(`${actorLabel} nhập kho từ file ${file.name}`);
      }
    } catch (err: any) {
      alert(err?.message || `Lỗi khi đọc file "${file.name}".`);
    } finally {
      setImportingAdminFile(false);
    }
}
