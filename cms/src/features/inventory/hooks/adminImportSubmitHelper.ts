import type React from "react";
import { apiRequest, getStoredUser } from "@/shared/api/client";
import { resolveVariantColorHexes } from "@/shared/ui/ColorSwatchPicker";
import type { Product } from "@/shared/types";
import type { InventoryState } from "./useInventoryState";

export async function submitAdminBatchImport(
  e: React.FormEvent,
  deps: {
    state: InventoryState;
    catalogByCode: Map<string, Product>;
    variantCodeFor: (baseCode?: string, color?: string, size?: string) => string;
    loadProductsAndCats: () => Promise<void>;
    loadCategoriesAndImports: () => Promise<void>;
    loadImports: () => Promise<void>;
    loadMovements: () => Promise<void>;
  }
) {
  const {
    state,
    catalogByCode,
    variantCodeFor,
    loadProductsAndCats,
    loadCategoriesAndImports,
    loadImports,
    loadMovements,
  } = deps;
  const {
    subTab,
    products,
    allCatalogProducts,
    submittingImportRef,
    submittingAdminImport,
    setStatusMsg,
    adminImportRows,
    newProdCatId,
    categories,
    newProdWarehouse,
    adminImportNote,
    setSubmittingAdminImport,
    setShowAdminImportModal,
    setAdminImportNote,
    setAdminImportRows,
  } = state;


    e.preventDefault();
    if (submittingImportRef.current || submittingAdminImport) return;
    setStatusMsg(null);

    const validRows = adminImportRows.filter(
      (r) => r.productName.trim() !== "" || r.productCode.trim() !== "" || Boolean(r.productId)
    );
    if (validRows.length === 0) {
      alert("Vui lòng chọn hoặc import ít nhất 1 dòng sản phẩm!");
      return;
    }

    const confirmedRows = validRows.filter((r) => r.isConfirmed);
    if (confirmedRows.length === 0) {
      alert(
        "Vui lòng tick xác nhận các dòng cần nhập (hoặc bấm 'Tick xác nhận tất cả') trước khi Hoàn thành Nhập Kho!"
      );
      return;
    }

    const invalidProdRow = confirmedRows.find((r) => {
      const matched =
        (r.productId &&
          (allCatalogProducts.length > 0 ? allCatalogProducts : products).find((p) => p._id === r.productId)) ||
        (r.productCode && catalogByCode.get(r.productCode.toUpperCase()));
      return !matched && !r.productId && !r.productCode;
    });
    if (invalidProdRow) {
      alert(
        `Dòng #${invalidProdRow.stt} chưa chọn Sản phẩm hợp lệ từ danh mục! Vui lòng chọn sản phẩm có sẵn hoặc bấm "+ Tạo SP mới" trên thanh công cụ.`
      );
      return;
    }

    const missingColorRow = confirmedRows.find((r) => !String(r.color || "").trim());
    if (missingColorRow) {
      alert(
        `Dòng #${missingColorRow.stt} ("${missingColorRow.productName}") chưa chọn biến thể hoặc chưa điền Màu sắc! Vui lòng chọn Biến thể (Màu • Size) trước khi nhập kho.`
      );
      return;
    }

    submittingImportRef.current = true;
    setSubmittingAdminImport(true);
    const floorText = newProdWarehouse === "FLOOR_2" ? "Kho Tầng 2" : "Kho Tầng 1";
    let createdReceiptId: string | null = null;
    try {
      const actor = getStoredUser();
      const actorLabel = actor?.fullName || "Nhân sự kho";
      const payloadItems = validRows.map((r, idx) => {
        const matchedProd =
          (r.productId &&
            (allCatalogProducts.length > 0 ? allCatalogProducts : products).find((p) => p._id === r.productId)) ||
          (r.productCode ? catalogByCode.get(r.productCode.toUpperCase()) : undefined);
        return {
          stt: idx + 1,
          // v5.0: gửi productId/productCode của sản phẩm đã chọn
          ...(r.productId || matchedProd?._id ? { productId: r.productId || matchedProd?._id } : {}),
          ...(r.productCode || matchedProd?.code ? { productCode: r.productCode || matchedProd?.code } : {}),
          ...(r.colorCode ? { colorCode: r.colorCode } : {}),
          productName: (r.productName || matchedProd?.name || "").trim(),
          brand: (r.brand || matchedProd?.brandName || matchedProd?.brand || "").trim(),
          color: r.color.trim(),
          colorHexes: resolveVariantColorHexes(r.color, r.colorHexes),
          size: r.size.trim().toUpperCase(),
          categoryId:
            r.categoryId ||
            (typeof matchedProd?.categoryId === "object"
              ? matchedProd.categoryId?._id
              : matchedProd?.categoryId) ||
            newProdCatId ||
            categories[0]?._id,
          unit: (r.unit || matchedProd?.unit || "Cái").trim() || "Cái",
          expectedQuantity: Math.max(1, Number(r.quantity || 1)),
          actualQuantity: Math.max(1, Number(r.quantity || 1)),
          costPrice: Math.max(0, Number(r.costPrice || 0)),
          sellingPrice: Math.max(0, Number(r.sellingPrice || 0)),
          note: r.note.trim(),
          isChecked: true,
          isConfirmed: r.isConfirmed,
          discrepancyNote: "Khớp đủ",
          ...(actor?._id ? { checkedBy: actor._id } : {}),
          ...(actor?.fullName ? { checkedByName: actor.fullName } : {}),
          ...(actor?.role ? { checkedByRole: actor.role } : {}),
        };
      });

      const createdRes = await apiRequest<any>("/imports", {
        method: "POST",
        body: JSON.stringify({
          note: adminImportNote.trim() || `${actorLabel} nhập kho (${confirmedRows.length} dòng)`,
          defaultCategoryId: newProdCatId || categories[0]?._id || undefined,
          targetWarehouse: newProdWarehouse,
          items: payloadItems,
        }),
      });

      const savedReceipt = createdRes.data;
      createdReceiptId = savedReceipt?._id || null;
      await apiRequest<any>(`/imports/${savedReceipt._id}/complete`, {
        method: "POST",
        body: JSON.stringify({
          defaultCategoryId: newProdCatId || categories[0]?._id || undefined,
          targetWarehouse: newProdWarehouse,
          items: savedReceipt.items || payloadItems,
        }),
      });
      createdReceiptId = null;

      const totalUnits = confirmedRows.reduce((s, r) => s + Math.max(1, Number(r.quantity || 1)), 0);
      setStatusMsg({
        type: "success",
        text: `Đã hoàn thành nhập kho ${confirmedRows.length} dòng (${totalUnits} sản phẩm) vào ${floorText} thành công!`,
      });

      setAdminImportNote("");
      setAdminImportRows([
        {
          stt: 1,
          productCode: "",
          productName: "",
          categoryId: newProdCatId || categories[0]?._id || "",
          brand: "",
          color: "",
          size: "",
          unit: "Cái",
          quantity: 1,
          costPrice: 0,
          sellingPrice: 0,
          note: "",
          isConfirmed: false,
        },
      ]);
      setShowAdminImportModal(false);
      await loadProductsAndCats();
      loadCategoriesAndImports();
      if (subTab === "HISTORY") {
        loadImports();
        loadMovements();
      }
    } catch (err: any) {
      // Nếu đã tạo phiếu DRAFT nhưng bước hoàn thành lỗi thì dọn phiếu DRAFT để tránh rác/trùng khi bấm thử lại
      if (createdReceiptId) {
        await apiRequest(`/imports/${createdReceiptId}`, { method: "DELETE" }).catch(() => {});
      }
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể nhập sản phẩm vào kho.",
      });
    } finally {
      submittingImportRef.current = false;
      setSubmittingAdminImport(false);
    }
}
