import { useState } from "react";
import type { ProductCodeCreatorResult } from "@/shared/ui/ProductCodeCreatorModal";
import { getFloor1Stock } from "../utils/stock";
import { useInventoryData } from "./useInventoryData";
import { useInventoryPriceEdit } from "./useInventoryPriceEdit";
import { useInventoryVariants } from "./useInventoryVariants";
import { useInventoryLabels } from "./useInventoryLabels";
import { useInventoryScanner } from "./useInventoryScanner";
import { useInventoryDisplayed } from "./useInventoryDisplayed";

export function useInventoryTab() {
  const {
    products,
    setProducts,
    categories,
    selectedCategory,
    setSelectedCategory,
    search,
    setSearch,
    totalProducts,
    totalStock,
    loading,
    activeWarehouse,
    setActiveWarehouse,
    floor1Codes,
    floor2Codes,
    setAllCatalogProducts,
    allCatalogProducts,
    brandFilter,
    setBrandFilter,
    brandOptions,
    variantCodeFor,
    currentUser,
    isSales,
    canSeeCostPrice,
    isAdmin,
    canCreateProduct,
    loadInventory,
    totalStockFloor1,
    totalStockFloor2,
    effectiveWarehouse,
  } = useInventoryData();

  const [priceStatusMsg, setPriceStatusMsg] = useState<string | null>(null);
  const [showCodeCreator, setShowCodeCreator] = useState(false);

  const { priceEdits, setPriceEdits, savingBatch, changedPriceProducts, handleSaveAllPriceChanges } =
    useInventoryPriceEdit({ products, setProducts, setPriceStatusMsg });

  const {
    expandedProdIds,
    setExpandedProdIds,
    newVariantDrafts,
    setNewVariantDrafts,
    addingVariantProdId,
    toggleExpandProduct,
    handleAddVariantToProduct,
  } = useInventoryVariants({ isAdmin, loadInventory, setPriceStatusMsg });

  const { labelModalItems, setLabelModalItems, expandProductToPrintLabelItems } = useInventoryLabels({
    priceEdits,
    effectiveWarehouse,
    variantCodeFor,
  });

  const scanner = useInventoryScanner({
    products,
    allCatalogProducts,
    setAllCatalogProducts,
    effectiveWarehouse,
    variantCodeFor,
    setExpandedProdIds,
    labelModalItems,
  });

  const displayedProducts = useInventoryDisplayed({
    products,
    isSales,
    effectiveWarehouse,
    floor1Codes,
    floor2Codes,
    search,
    onlyShowScanned: scanner.onlyShowScanned,
    scannedCheckCounts: scanner.scannedCheckCounts,
    brandFilter,
    brandOptions,
    variantCodeFor,
  });

  const handleCodeCreatorDone = async (result: ProductCodeCreatorResult) => {
    setPriceStatusMsg(
      result.mode === "CREATED"
        ? `Đã tạo sản phẩm "${result.product.name}" mã ${result.product.code}. Nhập tồn qua phiếu nhập kho.`
        : `Đã thêm ${result.variants.length} biến thể vào sản phẩm ${result.product.code}.`
    );
    setAllCatalogProducts((prev) => [
      result.product,
      ...prev.filter((p) => p._id !== result.product._id),
    ]);
    await loadInventory();
  };

  const colCount = (canSeeCostPrice ? 10 : 9) + (effectiveWarehouse === "ALL" ? 2 : 0);

  return {
    products,
    categories,
    selectedCategory,
    setSelectedCategory,
    search,
    setSearch,
    totalProducts,
    totalStock,
    loading,
    activeWarehouse,
    setActiveWarehouse,
    priceEdits,
    setPriceEdits,
    savingBatch,
    priceStatusMsg,
    expandedProdIds,
    newVariantDrafts,
    setNewVariantDrafts,
    addingVariantProdId,
    labelModalItems,
    setLabelModalItems,
    brandFilter,
    setBrandFilter,
    brandOptions,
    showCodeCreator,
    setShowCodeCreator,
    variantCodeFor,
    ...scanner,
    currentUser,
    isSales,
    canSeeCostPrice,
    isAdmin,
    canCreateProduct,
    handleCodeCreatorDone,
    loadInventory,
    changedPriceProducts,
    handleSaveAllPriceChanges,
    toggleExpandProduct,
    handleAddVariantToProduct,
    getFloor1Stock,
    totalStockFloor1,
    totalStockFloor2,
    effectiveWarehouse,
    expandProductToPrintLabelItems,
    displayedProducts,
    colCount,
  };
}
