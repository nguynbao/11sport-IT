import { categoryRepo, productRepo } from "../../repositories";
import type { IImportReceiptItem } from "../../models/ImportReceipt";
import { ApiError } from "../../shared/errors";
import { ok, ServiceResult } from "../../shared/result";
import {
  convertMatrixToImportRows,
  extractTextFromPdfBuffer,
  parseCsvTextToMatrix,
  parseRawTextToImportRows,
  parseXlsxBufferToMatrix,
  ParsedImportFileRow,
} from "../../shared/fileImportParser";
import {
  extractVariantFromText,
  generateProductCode,
  isNewSchemeProduct,
  buildVariantSku,
  generateVariantProductCode,
  normalizeToCompactUpperCode,
} from "../../shared/productCode";
import {
  loadImportSchemeContext,
  findExistingProductForImport,
  proposeImportProduct,
  resolveImportColorCode,
  resolveExplicitImportSchemeItem,
  findCodeConflictsInList,
} from "../catalog";
import { getFloorStocks, sanitizeColorHexes } from "../inventory";
import { ocrScanTable, ocrScanTag, parseTextToRows, sanitizeBarcode, validateOcrInput } from "../../infra/ocr";
import { parseCostPrice, parseSellingPrice, rowsToImportItems } from "./import.rules";

export async function parseImportFile(body: any): Promise<ServiceResult> {
  const {
      fileName = '',
      fileType = '',
      contentBase64 = '',
      base64Data = '',
      fileBase64 = '',
      rawText = '',
      rows = [],
      defaultCategoryId = '',
    } = body || {};
    const effectiveBase64 = String(contentBase64 || base64Data || fileBase64 || '');

    const [categories, catalogProducts] = await Promise.all([
      categoryRepo.find({ status: 'ACTIVE' }),
      productRepo.find({}),
    ]);

    const fallbackCatId = defaultCategoryId || categories[0]?._id || '';
    const catByName = new Map(
      categories.map((c) => [
        c.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[đĐ]/g, 'd')
          .trim(),
        c,
      ])
    );
    const catByCode = new Map(categories.map((c) => [String(c.code || '').toUpperCase(), c]));
    const prodByCode = new Map(catalogProducts.map((p) => [String(p.code || '').toUpperCase(), p]));

    let parsedRows: ParsedImportFileRow[] = [];
    const ext = String(fileName || '').toLowerCase();
    const cleanType = String(fileType || '').toUpperCase();
    let detectedFileType = cleanType || 'TEXT';

    if (Array.isArray(rows) && rows.length > 0) {
      detectedFileType = 'EXCEL';
      const matrix: string[][] = [
        ['Loại', 'Hãng', 'Tên sản phẩm', 'Màu sắc', 'Size', 'ĐVT', 'Số lượng', 'Giá gốc', 'Giá bán', 'Ghi chú'],
        ...rows.map((r: any) => [
          String(r.category || r.categoryName || ''),
          String(r.brand || ''),
          String(r.productName || r.name || ''),
          String(r.color || ''),
          String(r.size || ''),
          String(r.unit || 'Cái'),
          String(r.expectedQuantity ?? r.quantity ?? 1),
          String(r.costPrice ?? 0),
          String(r.sellingPrice ?? 0),
          String(r.note || ''),
        ]),
      ];
      parsedRows = convertMatrixToImportRows(matrix);
    } else if (effectiveBase64 && typeof effectiveBase64 === 'string') {
      const cleanB64 = effectiveBase64.replace(/^data:[^;]+;base64,/, '').trim();
      const buffer = Buffer.from(cleanB64, 'base64');

      if (ext.endsWith('.xlsx') || cleanType === 'EXCEL' || cleanType === 'XLSX') {
        detectedFileType = 'XLSX';
        const matrix = parseXlsxBufferToMatrix(buffer);
        parsedRows = convertMatrixToImportRows(matrix);
      } else if (ext.endsWith('.csv') || ext.endsWith('.tsv') || cleanType === 'CSV') {
        detectedFileType = 'CSV';
        const matrix = parseCsvTextToMatrix(buffer.toString('utf8'));
        parsedRows = convertMatrixToImportRows(matrix);
      } else if (ext.endsWith('.pdf') || cleanType === 'PDF') {
        detectedFileType = 'PDF';
        const pdfText = extractTextFromPdfBuffer(buffer);
        parsedRows = parseRawTextToImportRows(pdfText || rawText);
      } else {
        // Thử đọc như XLSX trước, nếu không phải ZIP thì đọc như CSV/Text
        const matrix = parseXlsxBufferToMatrix(buffer);
        if (matrix.length > 0) {
          detectedFileType = 'XLSX';
          parsedRows = convertMatrixToImportRows(matrix);
        } else {
          detectedFileType = 'CSV';
          const textContent = buffer.toString('utf8');
          const csvMatrix = parseCsvTextToMatrix(textContent);
          parsedRows = convertMatrixToImportRows(csvMatrix);
          if (parsedRows.length === 0) {
            parsedRows = parseRawTextToImportRows(textContent);
          }
        }
      }
    } else if (rawText && typeof rawText === 'string') {
      detectedFileType = 'TEXT';
      parsedRows = parseRawTextToImportRows(rawText);
    }

    const parseCtx = await loadImportSchemeContext();
    const finalItems: IImportReceiptItem[] = parsedRows.map((row, index) => {
      let existingProd =
        prodByCode.get(row.productCode) ||
        (row.hasExplicitCode ? findExistingProductForImport({ productCode: row.productCode }, parseCtx.products) : null) ||
        undefined;
      if (!existingProd && row.productName) {
        const lowerName = row.productName.trim().toLowerCase();
        existingProd = catalogProducts.find(
          (p) => String(p.name || '').trim().toLowerCase() === lowerName
        );
      }
      let resolvedCatId = existingProd?.categoryId || fallbackCatId;

      if (row.categoryName) {
        const normCat = row.categoryName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[đĐ]/g, 'd')
          .trim();
        const matchedCat =
          catByCode.get(row.categoryName.toUpperCase()) ||
          catByName.get(normCat) ||
          categories.find((c) =>
            c.name
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .includes(normCat)
          );
        if (matchedCat) resolvedCatId = String(matchedCat._id);
      }

      const resolvedCat = categories.find((c) => String(c._id) === String(resolvedCatId));
      const finalCode = existingProd?.code
        ? existingProd.code
        : generateProductCode(row.productName, {
            categoryCode: resolvedCat?.code,
            categoryName: resolvedCat?.name || row.categoryName,
            brand: row.brand,
            existingCode: row.productCode,
          });
      let finalCode2 = finalCode;
      let finalVariantCode = generateVariantProductCode(finalCode, row.color, row.size);
      let rowColorCode = '';
      if (existingProd && isNewSchemeProduct(existingProd)) {
        rowColorCode = resolveImportColorCode(parseCtx, existingProd.code, existingProd.variants || [], row.color);
        finalVariantCode = buildVariantSku(existingProd.code, rowColorCode, row.size);
      } else if (!existingProd && !row.hasExplicitCode) {
        // v5.0: sản phẩm chưa có & file không có cột Mã SP => đề xuất mã theo quy chuẩn mới
        const proposal = proposeImportProduct(parseCtx, {
          name: row.productName,
          brand: row.brand,
          categoryId: String(resolvedCatId),
        });
        if (proposal) {
          finalCode2 = proposal.code;
          const baseVariants = proposal.existing?.variants || [];
          rowColorCode = resolveImportColorCode(parseCtx, proposal.code, baseVariants, row.color);
          finalVariantCode = buildVariantSku(proposal.code, rowColorCode, row.size);
          if (proposal.existing) existingProd = proposal.existing;
        }
      }

      const costPrice =
        row.costPrice > 0 ? row.costPrice : Number(existingProd?.costPrice || 0);
      const sellingPrice =
        row.sellingPrice > 0 ? row.sellingPrice : Number(existingProd?.sellingPrice || 0);

      return {
        stt: index + 1,
        productId: existingProd ? String(existingProd._id) : '',
        productCode: finalCode2,
        variantCode: finalVariantCode,
        productName: existingProd ? existingProd.name : row.productName,
        brand: row.brand || existingProd?.brand || '',
        color: row.color || '',
        colorCode: rowColorCode,
        size: row.size || '',
        categoryId: resolvedCatId,
        unit: row.unit || existingProd?.unit || 'Cái',
        expectedQuantity: row.expectedQuantity,
        actualQuantity: row.actualQuantity,
        costPrice,
        sellingPrice,
        scannedQuantity: row.actualQuantity,
        barcode: finalVariantCode, // Mã vạch trên tem Label in theo Mã con của từng thuộc tính (Màu, Size)
        note: row.note || '',
        isChecked: true,
        isConfirmed: false,
        discrepancyNote: 'Khớp đủ',
      };
    });

    const totalQuantity = finalItems.reduce((sum, i) => sum + (Number(i.actualQuantity) || 0), 0);

    return ok({
        fileType: detectedFileType,
        items: finalItems,
        totalRows: finalItems.length,
        totalQuantity,
      }, {
        fileName,
        fileType: detectedFileType,
        totalExtracted: finalItems.length,
      });
}

export async function ocrPreview(body: any): Promise<ServiceResult> {
  const { imageText } = body || {};
    const categories = await categoryRepo.find({ status: 'ACTIVE' });
    const defaultCatId = categories[0]?._id || '';
    const extractedItems = rowsToImportItems(parseTextToRows(String(imageText || '')), defaultCatId);

    return ok({ items: extractedItems }, { totalExtracted: extractedItems.length });
}

export async function ocrScan(body: any): Promise<ServiceResult> {
  const { mode, fileBase64, mimeType } = body || {};
    const { data, mime } = validateOcrInput(fileBase64, mimeType);

    if (String(mode).toUpperCase() === 'TAG') {
      const tag = await ocrScanTag(data, mime);
      return ok(tag, {});
    }

    const categories = await categoryRepo.find({ status: 'ACTIVE' });
    const defaultCatId = categories[0]?._id || '';
    const result = await ocrScanTable(data, mime);
    const items = rowsToImportItems(result.rows, defaultCatId);

    return ok({ items, rawText: result.rawText, engine: result.engine }, { totalExtracted: items.length });
}

