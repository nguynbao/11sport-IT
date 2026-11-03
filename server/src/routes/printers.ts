import { Router, Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/errors';
import {
  listSystemPrinters,
  printBarcodeLabelsDirect,
  DirectPrintPayload,
  LabelPrintItem,
} from '../utils/windowsPrinter';

export const printersRouter = Router();

/**
 * GET /api/v1/printers
 * Quét danh sách máy in đang kết nối trên máy trạm/server Windows
 */
printersRouter.get(
  '/printers',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await listSystemPrinters();
      res.json({
        success: true,
        data: result,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/printers/print-labels
 * Gửi lệnh in tem mã vạch Code128 trực tiếp xuống máy in nhiệt 2 cột 70x20mm (Xprinter XP-350BM)
 */
printersRouter.post(
  '/printers/print-labels',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body || {}) as Partial<DirectPrintPayload>;
      const printerName = String(body.printerName || '').trim();
      if (!printerName) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng chọn máy in để in tem mã vạch', {
          printerName: 'Chưa chọn máy in',
        });
      }

      const syncOnly = Boolean(body.syncOnly);
      if (!syncOnly && (!Array.isArray(body.items) || body.items.length === 0)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Danh sách tem cần in không được để trống', {
          items: 'Rỗng',
        });
      }

      const columns: 1 | 2 = body.columns === 1 || body.preset?.columns === 1 ? 1 : 2;
      const pageWidthMm = Number(body.paperWidthMm) || Number(body.preset?.pageWidthMm) || 70;
      const pageHeightMm = Number(body.paperHeightMm) || Number(body.preset?.pageHeightMm) || 20;

      const result = await printBarcodeLabelsDirect({
        printerName,
        syncOnly,
        shopName: body.shopName,
        columns,
        paperWidthMm: pageWidthMm,
        paperHeightMm: pageHeightMm,
        preset: {
          id: body.preset?.id || '70x20_2up',
          widthMm: Number(body.preset?.widthMm) || 35,
          heightMm: Number(body.preset?.heightMm) || 20,
          columns,
          pageWidthMm,
          pageHeightMm,
        },
        options: {
          showShopName: body.options?.showShopName !== false,
          showProductName: Boolean(body.options?.showProductName),
          showPrice: body.options?.showPrice !== false,
        },
        items: (body.items || []).map((it: LabelPrintItem) => ({
          code: String(it.code || ''),
          name: String(it.name || ''),
          priceText: it.priceText ? String(it.priceText) : undefined,
          sellingPrice: Number(it.sellingPrice) || 0,
          quantity: Number(it.quantity) || 0,
        })),
      });

      res.json({
        success: true,
        data: result,
        message: `Đã in ${result.printedLabels} tem (${result.printedPages} hàng 70×20mm) tới máy in "${printerName}"`,
        meta: {},
      });
    } catch (err: any) {
      if (err instanceof ApiError) {
        return next(err);
      }
      return next(
        new ApiError(
          400,
          'PRINTER_ERROR',
          err?.message || 'Không thể gửi lệnh in tới máy in nhiệt.'
        )
      );
    }
  }
);
