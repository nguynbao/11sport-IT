import zlib from 'zlib';
import {
  extractVariantFromText,
  generateProductCode,
  isStandardSixDigitProductCode,
} from './productCode';

export interface ParsedImportFileRow {
  stt: number;
  categoryName?: string;
  brand: string;
  productName: string;
  productCode: string;
  color: string;
  size: string;
  unit: string;
  expectedQuantity: number;
  actualQuantity: number;
  costPrice: number;
  sellingPrice: number;
  barcode: string;
  note: string;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Giải nén các file XML bên trong file .xlsx (định dạng ZIP chuẩn) bằng Node zlib thuần.
 */
function extractZipEntries(buffer: Buffer): Map<string, string> {
  const entries = new Map<string, string>();
  let offset = 0;

  while (offset + 30 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
      offset++;
      continue;
    }

    const flags = buffer.readUInt16LE(offset + 6);
    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);

    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLen + extraLen;
    if (dataStart > buffer.length) break;

    const fileName = buffer.slice(nameStart, nameStart + fileNameLen).toString('utf8');

    // Nếu bit 3 của flags được bật (data descriptor), tìm signature tiếp theo nếu compressedSize = 0
    let actualCompressedSize = compressedSize;
    if ((flags & 0x08) !== 0 && actualCompressedSize === 0) {
      let nextSig = dataStart;
      while (nextSig + 4 <= buffer.length) {
        const sig = buffer.readUInt32LE(nextSig);
        if (sig === 0x04034b50 || sig === 0x02014b50 || sig === 0x08074b50) break;
        nextSig++;
      }
      actualCompressedSize = Math.max(0, nextSig - dataStart);
    }

    const dataEnd = Math.min(buffer.length, dataStart + actualCompressedSize);
    const rawSlice = buffer.slice(dataStart, dataEnd);

    if (fileName.endsWith('.xml') || fileName.endsWith('.rels')) {
      try {
        if (compressionMethod === 0) {
          entries.set(fileName, rawSlice.toString('utf8'));
        } else if (compressionMethod === 8) {
          const inflated = zlib.inflateRawSync(rawSlice);
          entries.set(fileName, inflated.toString('utf8'));
        }
      } catch {
        // Bỏ qua entry lỗi
      }
    }

    offset = dataEnd > offset ? dataEnd : offset + 30;
  }

  return entries;
}

function colLettersToIndex(letters: string): number {
  let idx = 0;
  for (let i = 0; i < letters.length; i++) {
    idx = idx * 26 + (letters.charCodeAt(i) - 64);
  }
  return Math.max(0, idx - 1);
}

/**
 * Đọc bảng 2 chiều các dòng/cột từ file .xlsx (Buffer).
 */
export function parseXlsxBufferToMatrix(buffer: Buffer): string[][] {
  const entries = extractZipEntries(buffer);
  if (entries.size === 0) return [];

  // 1. Đọc bảng chuỗi dùng chung xl/sharedStrings.xml
  const sharedStrings: string[] = [];
  const sstXml = entries.get('xl/sharedStrings.xml') || '';
  if (sstXml) {
    const siMatches = sstXml.match(/<si[\s>][\s\S]*?<\/si>/g) || [];
    for (const si of siMatches) {
      const tMatches = [...si.matchAll(/<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g)];
      const combined = tMatches.map((m) => decodeXmlEntities(m[1])).join('');
      sharedStrings.push(combined);
    }
  }

  // 2. Đọc tất cả các sheet xl/worksheets/sheet*.xml
  const rowsMatrix: string[][] = [];
  const sheetKeys = Array.from(entries.keys())
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k))
    .sort();

  for (const sheetKey of sheetKeys) {
    const sheetXml = entries.get(sheetKey) || '';
    const rowBlocks = sheetXml.match(/<row[\s>][\s\S]*?<\/row>/g) || [];
    for (const rowXml of rowBlocks) {
      const cells: string[] = [];
      const cBlocks = rowXml.match(/<c\s+[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || [];
      for (const cXml of cBlocks) {
        const refMatch = cXml.match(/\br="([A-Z]+)\d+"/i);
        const typeMatch = cXml.match(/\bt="([^"]+)"/i);
        const colIdx = refMatch ? colLettersToIndex(refMatch[1].toUpperCase()) : cells.length;
        const cellType = typeMatch ? typeMatch[1] : '';

        let val = '';
        if (cellType === 'inlineStr') {
          const tMatches = [...cXml.matchAll(/<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g)];
          val = tMatches.map((m) => decodeXmlEntities(m[1])).join('');
        } else {
          const vMatch = cXml.match(/<v>([\s\S]*?)<\/v>/);
          if (vMatch) {
            const rawV = decodeXmlEntities(vMatch[1].trim());
            if (cellType === 's') {
              const sIdx = parseInt(rawV, 10);
              val = !isNaN(sIdx) && sharedStrings[sIdx] !== undefined ? sharedStrings[sIdx] : rawV;
            } else {
              val = rawV;
            }
          }
        }

        while (cells.length <= colIdx) cells.push('');
        cells[colIdx] = val.trim();
      }

      if (cells.some((c) => c !== '')) {
        rowsMatrix.push(cells);
      }
    }
  }

  return rowsMatrix;
}

/**
 * Đọc bảng 2 chiều từ chuỗi CSV hoặc TSV.
 */
export function parseCsvTextToMatrix(csvText: string): string[][] {
  const clean = String(csvText || '').replace(/^\uFEFF/, '');
  const lines = clean
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.map((line) => {
    const delimiter = line.includes('\t') ? '\t' : line.includes(';') && !line.includes(',') ? ';' : ',';
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  });
}

/**
 * Giải mã text từ file PDF (hỗ trợ cả text stream thường và FlateDecode stream).
 */
export function extractTextFromPdfBuffer(buffer: Buffer): string {
  const rawLatin1 = buffer.toString('latin1');
  const extractedChunks: string[] = [];

  // Tìm tất cả các khối stream...endstream
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(rawLatin1)) !== null) {
    const streamBody = Buffer.from(match[1], 'latin1');
    let decodedContent = '';
    try {
      decodedContent = zlib.inflateSync(streamBody).toString('utf8');
    } catch {
      try {
        decodedContent = zlib.inflateRawSync(streamBody).toString('utf8');
      } catch {
        decodedContent = streamBody.toString('utf8');
      }
    }

    // Trích xuất chuỗi trong toán tử PDF Tj / TJ: (...) Tj hoặc [(...)] TJ
    const textMatches = [...decodedContent.matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g)];
    if (textMatches.length > 0) {
      const line = textMatches
        .map((m) =>
          m[1]
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, ' ')
            .replace(/\\t/g, '\t')
            .replace(/\\\(/g, '(')
            .replace(/\\\)/g, ')')
        )
        .join(' ');
      if (line.trim()) extractedChunks.push(line.trim());
    }
  }

  return extractedChunks.join('\n');
}

function parseCleanMoney(raw: any): number {
  if (typeof raw === 'number') return Math.max(0, Math.round(raw));
  const str = String(raw || '').trim();
  if (!str) return 0;
  // Loại bỏ chữ VND, đ, dấu chấm/phẩy phân cách hàng nghìn
  const digits = str.replace(/[^\d]/g, '');
  const val = parseInt(digits, 10);
  return isNaN(val) ? 0 : Math.max(0, val);
}

function parseCleanInt(raw: any, fallback = 0): number {
  if (typeof raw === 'number') return Math.max(0, Math.round(raw));
  const str = String(raw || '').trim();
  if (!str) return fallback;
  const digits = str.replace(/[^\d]/g, '');
  const val = parseInt(digits, 10);
  return isNaN(val) ? fallback : Math.max(0, val);
}

/**
 * Chuyển ma trận dòng/cột (từ Excel/CSV) thành danh sách mặt hàng nhập kho đã chuẩn hóa Mã viết HOA liền + Màu + Size.
 */
export function convertMatrixToImportRows(matrix: string[][]): ParsedImportFileRow[] {
  if (!Array.isArray(matrix) || matrix.length === 0) return [];

  // Tìm dòng tiêu đề (Header)
  let headerRowIdx = -1;
  const colMap = {
    code: -1,
    category: -1,
    brand: -1,
    model: -1,
    name: -1,
    color: -1,
    size: -1,
    unit: -1,
    quantity: -1,
    costPrice: -1,
    sellingPrice: -1,
    note: -1,
  };

  for (let r = 0; r < Math.min(10, matrix.length); r++) {
    const row = matrix[r].map((c) =>
      String(c || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .trim()
    );

    const hasNameCol = row.some(
      (c) =>
        c.includes('ten sp') ||
        c.includes('ten san pham') ||
        c.includes('ten hang') ||
        c.includes('san pham') ||
        c.includes('mat hang') ||
        c === 'model' ||
        c === 'mau' ||
        c.includes('dong sp')
    );
    const hasQtyOrBrand = row.some(
      (c) =>
        c.includes('so luong') ||
        c === 'sl' ||
        c.includes('sl nhap') ||
        c.includes('ton') ||
        c.includes('hang') ||
        c.includes('brand')
    );

    if (hasNameCol || hasQtyOrBrand) {
      headerRowIdx = r;
      row.forEach((colText, idx) => {
        if (!colText) return;
        if (colText === 'ma' || colText.includes('ma sp') || colText.includes('ma hang') || colText === 'code') {
          colMap.code = idx;
        } else if (colText.includes('loai') || colText.includes('danh muc') || colText.includes('category')) {
          colMap.category = idx;
        } else if (colText === 'hang' || colText.includes('thuong hieu') || colText.includes('brand')) {
          colMap.brand = idx;
        } else if (
          colText.includes('ten sp') ||
          colText.includes('ten san pham') ||
          colText.includes('ten hang') ||
          colText.includes('mat hang') ||
          colText === 'san pham'
        ) {
          colMap.name = idx;
        } else if (colText === 'model' || colText.includes('ten mau') || colText.includes('dong sp')) {
          colMap.model = idx;
        } else if (colText.includes('mau sac') || colText === 'mau' || colText === 'color') {
          colMap.color = idx;
        } else if (colText === 'size' || colText.includes('kich co') || colText === 'co') {
          colMap.size = idx;
        } else if (colText === 'dvt' || colText.includes('don vi')) {
          colMap.unit = idx;
        } else if (
          colText.includes('so luong') ||
          colText === 'sl' ||
          colText.includes('sl nhap') ||
          colText.includes('thuc nhan') ||
          colText.includes('ton')
        ) {
          if (colMap.quantity < 0) colMap.quantity = idx;
        } else if (colText.includes('gia goc') || colText.includes('gia nhap') || colText.includes(' gia von')) {
          colMap.costPrice = idx;
        } else if (colText.includes('gia ban') || colText.includes('niem yet') || colText === 'don gia') {
          colMap.sellingPrice = idx;
        } else if (colText.includes('ghi chu') || colText === 'note') {
          colMap.note = idx;
        }
      });
      break;
    }
  }

  const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
  const parsed: ParsedImportFileRow[] = [];

  for (let r = startRow; r < matrix.length; r++) {
    const cells = matrix[r];
    if (!cells || cells.every((c) => !String(c || '').trim())) continue;

    let categoryName = colMap.category >= 0 ? String(cells[colMap.category] || '').trim() : '';
    let brand = colMap.brand >= 0 ? String(cells[colMap.brand] || '').trim() : '';
    const model = colMap.model >= 0 ? String(cells[colMap.model] || '').trim() : '';
    let rawName = colMap.name >= 0 ? String(cells[colMap.name] || '').trim() : '';
    let color = colMap.color >= 0 ? String(cells[colMap.color] || '').trim() : '';
    let size = colMap.size >= 0 ? String(cells[colMap.size] || '').trim() : '';
    let unit = colMap.unit >= 0 ? String(cells[colMap.unit] || '').trim() : 'Cái';
    let qty = colMap.quantity >= 0 ? parseCleanInt(cells[colMap.quantity], 1) : 1;
    let costPrice = colMap.costPrice >= 0 ? parseCleanMoney(cells[colMap.costPrice]) : 0;
    let sellingPrice = colMap.sellingPrice >= 0 ? parseCleanMoney(cells[colMap.sellingPrice]) : 0;
    const note = colMap.note >= 0 ? String(cells[colMap.note] || '').trim() : '';
    const explicitCode = colMap.code >= 0 ? String(cells[colMap.code] || '').trim() : '';

    // Nếu không có header hoặc cột name trống nhưng có brand/model
    if (!rawName && (brand || model)) {
      const prefix =
        categoryName &&
        !brand.toLowerCase().startsWith(categoryName.toLowerCase()) &&
        ['áo', 'quần', 'giày', 'vợt', 'bóng'].some((k) => categoryName.toLowerCase().includes(k))
          ? `${categoryName} `
          : '';
      rawName = `${prefix}${brand} ${model}`.replace(/\s+/g, ' ').trim();
    } else if (!rawName && headerRowIdx < 0) {
      // Fallback không có dòng tiêu đề: [Tên SP, Màu, Size, ĐVT, SL, Giá gốc, Giá bán] hoặc [Tên SP, ĐVT, SL]
      rawName = String(cells[0] || '').trim();
      if (cells.length >= 5) {
        color = String(cells[1] || '').trim();
        size = String(cells[2] || '').trim();
        unit = String(cells[3] || 'Cái').trim() || 'Cái';
        qty = parseCleanInt(cells[4], 1);
        costPrice = parseCleanMoney(cells[5]);
        sellingPrice = parseCleanMoney(cells[6]);
      } else if (cells.length >= 3) {
        unit = String(cells[1] || 'Cái').trim() || 'Cái';
        qty = parseCleanInt(cells[2], 1);
        costPrice = parseCleanMoney(cells[3]);
        sellingPrice = parseCleanMoney(cells[4]);
      } else if (cells.length === 2) {
        qty = parseCleanInt(cells[1], 1);
      }
    }

    // Bỏ qua dòng tổng cộng hoặc dòng tiêu đề lặp lại
    const lowerName = rawName.toLowerCase();
    if (
      !rawName ||
      lowerName === 'tổng' ||
      lowerName === 'tổng cộng' ||
      lowerName === 'tên sản phẩm' ||
      lowerName === 'tên hàng' ||
      /^\d+$/.test(rawName)
    ) {
      continue;
    }

    const extracted = extractVariantFromText(rawName, {
      categoryName,
      brand,
      modelName: model,
    });

    const finalColor = color || extracted.color;
    const finalSize = (size || extracted.size).toUpperCase();
    const cleanBaseName = extracted.baseName || rawName;
    const finalCode =
      explicitCode && isStandardSixDigitProductCode(explicitCode)
        ? generateProductCode(explicitCode, { keepVariantInCode: true })
        : generateProductCode(cleanBaseName, {
            categoryName,
            brand: brand || extracted.brand,
            modelName: model,
            existingCode: explicitCode,
          });

    if (!finalCode) continue;

    parsed.push({
      stt: parsed.length + 1,
      categoryName,
      brand: brand || extracted.brand,
      productName: cleanBaseName,
      productCode: finalCode,
      color: finalColor,
      size: finalSize,
      unit: unit || 'Cái',
      expectedQuantity: Math.max(1, qty),
      actualQuantity: Math.max(1, qty),
      costPrice,
      sellingPrice,
      barcode: finalCode, // Mã vạch trên tem Label chỉ là Mã sản phẩm chung
      note,
    });
  }

  return parsed;
}

/**
 * Phân tích văn bản thô (từ PDF hoặc copy/paste) thành danh sách mặt hàng nhập kho.
 */
export function parseRawTextToImportRows(rawText: string): ParsedImportFileRow[] {
  const clean = String(rawText || '').trim();
  if (!clean) return [];

  // Nếu có dạng bảng phân cách bằng tab hoặc dấu phẩy/chấm phẩy
  if (clean.includes('\t') || clean.split(/\r?\n/).some((l) => l.split(',').length >= 4)) {
    const matrix = parseCsvTextToMatrix(clean);
    const fromMatrix = convertMatrixToImportRows(matrix);
    if (fromMatrix.length > 0) return fromMatrix;
  }

  const lines = clean
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 2);

  const results: ParsedImportFileRow[] = [];
  const unitsRegex = /\b(Cái|Cai|Chiếc|Chiec|Bộ|Bo|Đôi|Doi|Hộp|Hop|Quả|Qua|Chai|Cuộn|Cuon|Túi|Tui)\b/i;

  for (const line of lines) {
    if (/^(stt|tổng|tong cong|danh sách|phiếu nhập)/i.test(line)) continue;
    const withoutStt = line.replace(/^\d+[\.\)\-\s]+/, '').trim();
    if (!withoutStt) continue;

    let unit = 'Cái';
    const uMatch = withoutStt.match(unitsRegex);
    if (uMatch) unit = uMatch[1];

    const numbers = [...withoutStt.matchAll(/\b(\d+(?:[\.,]\d{3})*)\b/g)].map((m) =>
      parseCleanMoney(m[1])
    );

    let qty = 1;
    let costPrice = 0;
    let sellingPrice = 0;

    if (numbers.length >= 3) {
      const smallNums = numbers.filter((n) => n > 0 && n < 10000);
      const bigNums = numbers.filter((n) => n >= 10000);
      qty = smallNums.length > 0 ? smallNums[smallNums.length - 1] : 1;
      if (bigNums.length >= 2) {
        costPrice = bigNums[0];
        sellingPrice = bigNums[1];
      } else if (bigNums.length === 1) {
        sellingPrice = bigNums[0];
      }
    } else if (numbers.length === 2) {
      if (numbers[1] >= 10000) {
        qty = numbers[0] || 1;
        sellingPrice = numbers[1];
      } else {
        qty = numbers[1] || 1;
      }
    } else if (numbers.length === 1) {
      if (numbers[0] < 10000) qty = numbers[0] || 1;
      else sellingPrice = numbers[0];
    }

    // Cắt bỏ phần ĐVT và số lượng/giá ở cuối dòng để lấy tên hàng
    let namePart = withoutStt;
    if (uMatch && uMatch.index !== undefined) {
      namePart = withoutStt.slice(0, uMatch.index).trim();
    } else {
      namePart = withoutStt.replace(/[\s\-|]+\d+(?:[\.,]\d{3})*(?:[\s\-|]+\d+(?:[\.,]\d{3})*)*\s*$/, '').trim();
    }

    if (!namePart) continue;
    const extracted = extractVariantFromText(namePart);
    if (!extracted.code) continue;

    results.push({
      stt: results.length + 1,
      brand: extracted.brand,
      productName: extracted.baseName,
      productCode: extracted.code,
      color: extracted.color,
      size: extracted.size,
      unit,
      expectedQuantity: Math.max(1, qty),
      actualQuantity: Math.max(1, qty),
      costPrice,
      sellingPrice,
      barcode: extracted.code,
      note: '',
    });
  }

  return results;
}
