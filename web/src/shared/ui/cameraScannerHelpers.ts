import type { ImportItem } from "@/shared/types";

export type PreviewKind = "image" | "pdf" | null;
export type ScanTargetMode = "append" | "replaceLast";

export interface ScannedPage {
  id: string;
  name: string;
  kind: "image" | "pdf" | "text";
  dataUrl: string;
  mime: string;
  items: ImportItem[];
  rawText: string;
}

const MAX_IMAGE_DIM = 1600;
export const MAX_PDF_BYTES = 6 * 1024 * 1024;

export const createEmptyOcrItem = (stt: number): ImportItem => ({
  stt,
  productName: "",
  productCode: "",
  unit: "Cái",
  expectedQuantity: 1,
  actualQuantity: 1,
  costPrice: 0,
  note: "",
  isChecked: false,
  isConfirmed: false,
});

/** Thu nhỏ & nén ảnh về JPEG để gửi API nhanh, tránh vượt giới hạn dung lượng. */
export function compressImageToDataUrl(source: CanvasImageSource, w: number, h: number): string {
  const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function loadImageFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        resolve(compressImageToDataUrl(img, img.naturalWidth, img.naturalHeight));
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không đọc được ảnh (định dạng HEIC có thể chưa được trình duyệt hỗ trợ)."));
    };
    img.src = url;
  });
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Không đọc được file."));
    r.readAsDataURL(file);
  });
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Không đọc được file."));
    r.readAsText(file, "utf-8");
  });
}

export function mapApiItems(list: any[]): ImportItem[] {
  return list.map((it: any, idx: number) => {
    const pName = it.productName || it.name || "";
    const qty = Number(it.expectedQuantity ?? it.quantity ?? 1) || 1;
    return {
      stt: idx + 1,
      productName: pName,
      productCode: it.productCode || "", // v5.0: mã do server sinh
      unit: it.unit || "Cái",
      expectedQuantity: qty,
      actualQuantity: qty,
      costPrice: Number(it.costPrice || 0),
      note: it.note || "",
      isChecked: false,
      isConfirmed: false,
    };
  });
}

/**
 * Cộng thêm các dòng mới quét vào danh sách hiện có:
 * - Bỏ qua các dòng trống.
 * - Nếu mergeDuplicates = true và trùng productCode: cộng dồn expectedQuantity & actualQuantity.
 * - Nếu không trùng (hoặc tắt gộp): nối thêm dòng vào cuối bảng.
 */
export function mergeOcrItemsList(
  existing: ImportItem[],
  incoming: ImportItem[],
  mergeDuplicates: boolean
): { merged: ImportItem[]; addedRows: number; mergedRows: number } {
  const base = existing.filter((i) => i.productName.trim() !== "").map((i) => ({ ...i }));
  let addedRows = 0;
  let mergedRows = 0;

  for (const raw of incoming) {
    const pName = (raw.productName || "").trim();
    if (!pName) continue;
    const pCode = raw.productCode || "";
    const qty = Math.max(1, Number(raw.expectedQuantity) || 1);

    if (mergeDuplicates && pCode) {
      const foundIdx = base.findIndex(
        (b) => (b.productCode || "") === pCode
      );
      if (foundIdx >= 0) {
        const target = base[foundIdx];
        const nextQty = (Number(target.expectedQuantity) || 0) + qty;
        base[foundIdx] = {
          ...target,
          expectedQuantity: nextQty,
          actualQuantity: nextQty,
          note:
            raw.note && raw.note !== target.note
              ? [target.note, raw.note].filter(Boolean).join("; ")
              : target.note,
        };
        mergedRows++;
        continue;
      }
    }

    base.push({
      ...raw,
      productName: pName,
      productCode: pCode,
      expectedQuantity: qty,
      actualQuantity: qty,
    });
    addedRows++;
  }

  const finalItems =
    base.length > 0
      ? base.map((it, idx) => ({ ...it, stt: idx + 1 }))
      : [createEmptyOcrItem(1)];

  return { merged: finalItems, addedRows, mergedRows };
}
