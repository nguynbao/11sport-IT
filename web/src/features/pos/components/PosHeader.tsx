import { ScanLine } from "lucide-react";
import type { PosCtx } from "../hooks/usePosTab";
import { PosSearchBox } from "./PosSearchBox";
import { DraftTabs } from "./DraftTabs";

type PosHeaderProps = Pick<
  PosCtx,
  "searchBoxRef" | "search" | "setShowSearchDropdown" | "setSearch" | "setCatalogPage"
  | "handleBarcodeScanForPos" | "showSearchDropdown" | "filteredAndSortedProducts"
  | "getFloor1Stock" | "handleSelectProductForPos" | "setScannerEnabled"
  | "scannerEnabled" | "liveDrafts" | "activeDraftId" | "handleSwitchDraft"
  | "submitting" | "handleCloseDraft" | "handleAddDraft"
> & {
};

export function PosHeader({
  searchBoxRef,
  search,
  setShowSearchDropdown,
  setSearch,
  setCatalogPage,
  handleBarcodeScanForPos,
  showSearchDropdown,
  filteredAndSortedProducts,
  getFloor1Stock,
  handleSelectProductForPos,
  setScannerEnabled,
  scannerEnabled,
  liveDrafts,
  activeDraftId,
  handleSwitchDraft,
  submitting,
  handleCloseDraft,
  handleAddDraft,
}: PosHeaderProps) {
  return (
    <div className="bg-blue-600 text-white px-3 pt-2 pb-0 flex flex-wrap items-center justify-between gap-2 select-none shrink-0">
            {/* Bên trái: Ô tìm kiếm hàng hóa + Nút máy quét mã vạch + Các Tab Hóa đơn */}
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              {/* Ô tìm kiếm hàng hóa có Dropdown chọn nhanh */}
              <PosSearchBox
                searchBoxRef={searchBoxRef}
                search={search}
                setShowSearchDropdown={setShowSearchDropdown}
                setSearch={setSearch}
                setCatalogPage={setCatalogPage}
                handleBarcodeScanForPos={handleBarcodeScanForPos}
                showSearchDropdown={showSearchDropdown}
                filteredAndSortedProducts={filteredAndSortedProducts}
                getFloor1Stock={getFloor1Stock}
                handleSelectProductForPos={handleSelectProductForPos}
              />

              {/* Nút bật/tắt chế độ Máy quét mã vạch `[|||]` */}
              <div className="pb-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setScannerEnabled((prev) => !prev)}
                  title={
                    scannerEnabled
                      ? "Máy quét mã vạch ĐANG BẬT (Bấm để tạm tắt)"
                      : "Máy quét mã vạch ĐANG TẮT (Bấm để bật)"
                  }
                  className={`h-9 px-2.5 rounded-md flex items-center gap-1.5 text-xs font-bold transition border ${
                    scannerEnabled
                      ? "bg-white/15 border-white/40 text-white hover:bg-white/25"
                      : "bg-slate-900/40 border-white/10 text-white/60 hover:bg-white/15"
                  }`}
                >
                  <ScanLine className="w-4 h-4" />
                </button>
              </div>

              {/* Danh sách Tab Hóa đơn (Hóa đơn 1, Hóa đơn 2...) */}
              <DraftTabs
                liveDrafts={liveDrafts}
                activeDraftId={activeDraftId}
                handleSwitchDraft={handleSwitchDraft}
                submitting={submitting}
                handleCloseDraft={handleCloseDraft}
                handleAddDraft={handleAddDraft}
              />
            </div>
          </div>
  );
}
