/**
 * Quy chuẩn Mã sản phẩm 11Sport (v3.2):
 * 1. Mã Gốc (Root Code): [Chữ cái đầu tiên của Category] + [Tên Hãng IN HOA (không có hãng = NN)] + [6 chữ số bất kỳ]
 *    - Ví dụ có hãng: Category "Giày" (G) + Hãng "Asia" (ASIA) + 6 chữ số (221401) => GASIA221401
 *    - Ví dụ không có hãng: Category "Giày" (G) + Không hãng (NN) + 6 chữ số (221401) => GNN221401
 * 2. Mã Con theo thuộc tính Màu + Size (Variant Code / Child SKU):
 *    - Công thức: [Mã Gốc IN HOA][MÀU IN HOA KHÔNG DẤU VIẾT LIỀN][SIZE IN HOA VIẾT LIỀN]
 *    - Ví dụ: Giày đỏ size 38 => GASIA221401DO38, Giày đỏ size 39 => GASIA221401DO39
 *    - In tem mã vạch và quét kiểm kho / bán hàng POS đều sử dụng Mã Con này.
 */

export interface ProductCodeOptions {
  name?: string;
  categoryCode?: string;
  categoryName?: string;
  brand?: string;
  modelName?: string;
  color?: string;
  size?: string;
  sixDigits?: string;
  existingCode?: string;
  seedSuffix?: string;
  keepVariantInCode?: boolean;
}

export interface ExtractedProductVariantInfo {
  baseName: string;
  code: string;
  variantCode: string;
  brand: string;
  modelName: string;
  color: string;
  size: string;
  categoryInitial: string;
  brandCode: string;
  sixDigits: string;
}

const KNOWN_COLORS_MAP: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(xanh\s*duong|xanh\s*dương)\b/i, label: 'Xanh Dương' },
  { pattern: /\b(xanh\s*la|xanh\s*lá)\b/i, label: 'Xanh Lá' },
  { pattern: /\b(xanh\s*den|xanh\s*đen|navy)\b/i, label: 'Xanh Đen' },
  { pattern: /\b(xanh\s*ngoc|xanh\s*ngọc)\b/i, label: 'Xanh Ngọc' },
  { pattern: /\b(do|đỏ|red)\b/i, label: 'Đỏ' },
  { pattern: /\b(den|đen|black)\b/i, label: 'Đen' },
  { pattern: /\b(trang|trắng|white)\b/i, label: 'Trắng' },
  { pattern: /\b(xanh|blue)\b/i, label: 'Xanh' },
  { pattern: /\b(vang|vàng|yellow|gold)\b/i, label: 'Vàng' },
  { pattern: /\b(hong|hồng|pink)\b/i, label: 'Hồng' },
  { pattern: /\b(tim|tím|purple)\b/i, label: 'Tím' },
  { pattern: /\b(xam|xám|ghi|gray|grey)\b/i, label: 'Xám' },
  { pattern: /\b(cam|orange)\b/i, label: 'Cam' },
  { pattern: /\b(nau|nâu|brown)\b/i, label: 'Nâu' },
  { pattern: /\b(be|kem|beige|cream)\b/i, label: 'Kem' },
  { pattern: /\b(bac|bạc|silver)\b/i, label: 'Bạc' },
  { pattern: /\b(la|lá|green)\b/i, label: 'Xanh Lá' },
];

/**
 * Danh sách thương hiệu thể thao phổ biến tại 11Sport để tự động nhận diện Tên Hãng từ tên sản phẩm.
 * Nếu không có hãng thì mặc định là NN (No Name).
 */
const KNOWN_BRANDS: { pattern: RegExp; code: string; display: string }[] = [
  { pattern: /\b(under\s*armour|underarmour)\b/i, code: 'UNDERARMOUR', display: 'Under Armour' },
  { pattern: /\b(new\s*balance|newbalance)\b/i, code: 'NEWBALANCE', display: 'New Balance' },
  { pattern: /\b(thuong\s*dinh|thượng\s*đình|thuongdinh)\b/i, code: 'THUONGDINH', display: 'Thượng Đình' },
  { pattern: /\b(dong\s*luc|động\s*lực|dongluc)\b/i, code: 'DONGLUC', display: 'Động Lực' },
  { pattern: /\b(pickleballo)\b/i, code: 'PICKLEBALLO', display: 'Pickleballo' },
  { pattern: /\b(paddletek)\b/i, code: 'PADDLETEK', display: 'Paddletek' },
  { pattern: /\b(jogabola|jogarbola)\b/i, code: 'JOGABOLA', display: 'Jogabola' },
  { pattern: /\b(kaitashi)\b/i, code: 'KAITASHI', display: 'Kaitashi' },
  { pattern: /\b(kawasaki)\b/i, code: 'KAWASAKI', display: 'Kawasaki' },
  { pattern: /\b(franklin)\b/i, code: 'FRANKLIN', display: 'Franklin' },
  { pattern: /\b(decathlon)\b/i, code: 'DECATHLON', display: 'Decathlon' },
  { pattern: /\b(uhlsport)\b/i, code: 'UHLSPORT', display: 'Uhlsport' },
  { pattern: /\b(converse)\b/i, code: 'CONVERSE', display: 'Converse' },
  { pattern: /\b(spalding)\b/i, code: 'SPALDING', display: 'Spalding' },
  { pattern: /\b(six\s*zero|sixzero)\b/i, code: 'SIXZERO', display: 'Six Zero' },
  { pattern: /\b(goodfit)\b/i, code: 'GOODFIT', display: 'Goodfit' },
  { pattern: /\b(facolos)\b/i, code: 'FACOLOS', display: 'Facolos' },
  { pattern: /\b(selkirk)\b/i, code: 'SELKIRK', display: 'Selkirk' },
  { pattern: /\b(thunder)\b/i, code: 'THUNDER', display: 'Thunder' },
  { pattern: /\b(babolat)\b/i, code: 'BABOLAT', display: 'Babolat' },
  { pattern: /\b(gearbox)\b/i, code: 'GEARBOX', display: 'Gearbox' },
  { pattern: /\b(passion)\b/i, code: 'PASSION', display: 'Passion' },
  { pattern: /\b(artengo)\b/i, code: 'ARTENGO', display: 'Artengo' },
  { pattern: /\b(kalenji)\b/i, code: 'KALENJI', display: 'Kalenji' },
  { pattern: /\b(diadora)\b/i, code: 'DIADORA', display: 'Diadora' },
  { pattern: /\b(kamito)\b/i, code: 'KAMITO', display: 'Kamito' },
  { pattern: /\b(mizuno)\b/i, code: 'MIZUNO', display: 'Mizuno' },
  { pattern: /\b(zocker)\b/i, code: 'ZOCKER', display: 'Zocker' },
  { pattern: /\b(promax)\b/i, code: 'PROMAX', display: 'Promax' },
  { pattern: /\b(dalton)\b/i, code: 'DALTON', display: 'Dalton' },
  { pattern: /\b(ligpro)\b/i, code: 'LIGPRO', display: 'Ligpro' },
  { pattern: /\b(lippro)\b/i, code: 'LIPPRO', display: 'Lippro' },
  { pattern: /\b(soxter)\b/i, code: 'SOXTER', display: 'Soxter' },
  { pattern: /\b(li[\s\-]*ning|lining)\b/i, code: 'LINING', display: 'Lining' },
  { pattern: /\b(victor)\b/i, code: 'VICTOR', display: 'Victor' },
  { pattern: /\b(adidas)\b/i, code: 'ADIDAS', display: 'Adidas' },
  { pattern: /\b(wilson)\b/i, code: 'WILSON', display: 'Wilson' },
  { pattern: /\b(prince)\b/i, code: 'PRINCE', display: 'Prince' },
  { pattern: /\b(kumpoo)\b/i, code: 'KUMPOO', display: 'Kumpoo' },
  { pattern: /\b(proace)\b/i, code: 'PROACE', display: 'Proace' },
  { pattern: /\b(venson)\b/i, code: 'VENSON', display: 'Venson' },
  { pattern: /\b(molten)\b/i, code: 'MOLTEN', display: 'Molten' },
  { pattern: /\b(mikasa)\b/i, code: 'MIKASA', display: 'Mikasa' },
  { pattern: /\b(kipsta)\b/i, code: 'KIPSTA', display: 'Kipsta' },
  { pattern: /\b(speedo)\b/i, code: 'SPEEDO', display: 'Speedo' },
  { pattern: /\b(garmin)\b/i, code: 'GARMIN', display: 'Garmin' },
  { pattern: /\b(reusch)\b/i, code: 'REUSCH', display: 'Reusch' },
  { pattern: /\b(select)\b/i, code: 'SELECT', display: 'Select' },
  { pattern: /\b(beyono)\b/i, code: 'BEYONO', display: 'Beyono' },
  { pattern: /\b(bulbal)\b/i, code: 'BULBAL', display: 'Bulbal' },
  { pattern: /\b(reebok)\b/i, code: 'REEBOK', display: 'Reebok' },
  { pattern: /\b(pikdy)\b/i, code: 'PIKDY', display: 'Pikdy' },
  { pattern: /\b(sypik)\b/i, code: 'SYPIK', display: 'Sypik' },
  { pattern: /\b(joola)\b/i, code: 'JOOLA', display: 'Joola' },
  { pattern: /\b(asics)\b/i, code: 'ASICS', display: 'Asics' },
  { pattern: /\b(lotto)\b/i, code: 'LOTTO', display: 'Lotto' },
  { pattern: /\b(picko)\b/i, code: 'PICKO', display: 'Picko' },
  { pattern: /\b(yonex)\b/i, code: 'YONEX', display: 'Yonex' },
  { pattern: /\b(fleet)\b/i, code: 'FLEET', display: 'Fleet' },
  { pattern: /\b(apacs)\b/i, code: 'APACS', display: 'Apacs' },
  { pattern: /\b(felet)\b/i, code: 'FELET', display: 'Felet' },
  { pattern: /\b(arena)\b/i, code: 'ARENA', display: 'Arena' },
  { pattern: /\b(kelme)\b/i, code: 'KELME', display: 'Kelme' },
  { pattern: /\b(umbro)\b/i, code: 'UMBRO', display: 'Umbro' },
  { pattern: /\b(kappa)\b/i, code: 'KAPPA', display: 'Kappa' },
  { pattern: /\b(mitre)\b/i, code: 'MITRE', display: 'Mitre' },
  { pattern: /\b(bitis|biti's)\b/i, code: 'BITIS', display: 'Bitis' },
  { pattern: /\b(asia)\b/i, code: 'ASIA', display: 'Asia' },
  { pattern: /\b(wika)\b/i, code: 'WIKA', display: 'Wika' },
  { pattern: /\b(pili)\b/i, code: 'PILI', display: 'Pili' },
  { pattern: /\b(crbn)\b/i, code: 'CRBN', display: 'CRBN' },
  { pattern: /\b(wiro)\b/i, code: 'WIRO', display: 'Wiro' },
  { pattern: /\b(nike)\b/i, code: 'NIKE', display: 'Nike' },
  { pattern: /\b(puma)\b/i, code: 'PUMA', display: 'Puma' },
  { pattern: /\b(head)\b/i, code: 'HEAD', display: 'Head' },
  { pattern: /\b(mira)\b/i, code: 'MIRA', display: 'Mira' },
  { pattern: /\b(egan)\b/i, code: 'EGAN', display: 'Egan' },
  { pattern: /\b(joma)\b/i, code: 'JOMA', display: 'Joma' },
  { pattern: /\b(vans)\b/i, code: 'VANS', display: 'Vans' },
  { pattern: /\b(fila)\b/i, code: 'FILA', display: 'Fila' },
  { pattern: /\b(anta)\b/i, code: 'ANTA', display: 'Anta' },
  { pattern: /\b(peak)\b/i, code: 'PEAK', display: 'Peak' },
  { pattern: /\b(xtep)\b/i, code: 'XTEP', display: 'Xtep' },
  { pattern: /\b(rpm)\b/i, code: 'RPM', display: 'RPM' },
  { pattern: /\b(vnb)\b/i, code: 'VNB', display: 'VNB' },
];

const NO_BRAND_TOKENS = new Set([
  '',
  'NN',
  'NONAME',
  'NO',
  'NONE',
  'NA',
  'KHONGHANG',
  'KHONG',
  'KHONGCO',
  'KHAC',
  'OEM',
  '11SPORT',
]);

/**
 * Chuẩn hóa chuỗi thành CHỮ IN HOA VIẾT LIỀN (không khoảng trắng, không dấu gạch).
 */
export function normalizeToCompactUpperCode(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
}

/**
 * Tách các từ (tokens) IN HOA không dấu để phục vụ tìm kiếm / đối chiếu tag.
 */
export function tokenizeUpperAlphaNum(input: string): string[] {
  if (!input || typeof input !== 'string') return [];
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'D')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

export function normalizeToUpperCode(input: string): string {
  return normalizeToCompactUpperCode(input);
}

/**
 * Chuẩn hóa khóa định danh biến thể (Màu + Size) bên trong 1 sản phẩm.
 */
export function buildVariantKey(color?: string, size?: string): string {
  const c = normalizeToCompactUpperCode(String(color || '').trim());
  const s = normalizeToCompactUpperCode(String(size || '').trim());
  if (!c && !s) return 'DEFAULT';
  return `${c || 'NONE'}_${s || 'NONE'}`;
}

/**
 * Rút gọn chuỗi màu sắc dài (nhiều từ) khi tổng chiều dài Mã con vượt quá 19 ký tự
 * để đảm bảo mã vạch Code128 luôn nằm gọn trong khổ tem nhiệt 35×20mm (203 DPI = 276 dots)
 * mà không bị cắt mất vạch Start/Stop ở 2 mép tem.
 */
function buildCompactColorToken(rawColor: string, maxColorLen: number): string {
  const words = tokenizeUpperAlphaNum(rawColor);
  const filteredWords = words.length > 1 && words[0] === 'MAU' ? words.slice(1) : words;
  const fullColor = filteredWords.join('');
  if (!fullColor || fullColor.length <= maxColorLen) return fullColor;

  const digits = filteredWords.filter((w) => /^\d+$/.test(w)).join('');
  const alphaWords = filteredWords.filter((w) => !/^\d+$/.test(w));
  if (alphaWords.length === 0) {
    return fullColor.slice(0, maxColorLen);
  }
  if (alphaWords.length === 1) {
    const take = Math.max(2, maxColorLen - digits.length);
    return alphaWords[0].slice(0, take) + digits;
  }

  const budget = Math.max(4, maxColorLen - digits.length);
  const firstWord = alphaWords[0];
  const lastWord = alphaWords[alphaWords.length - 1];
  const midInitials =
    alphaWords.length > 2
      ? alphaWords
          .slice(1, -1)
          .map((w) => w[0])
          .join('')
      : '';
  const firstPart = firstWord.slice(0, Math.min(2, firstWord.length));
  const remForLast = Math.max(1, budget - firstPart.length - midInitials.length);
  const lastPart = lastWord.slice(0, Math.min(lastWord.length, Math.max(2, remForLast)));
  const combined = (firstPart + midInitials + lastPart).slice(0, budget);
  return combined + digits;
}

/**
 * Sinh Mã Con (Variant Code / Child SKU) cho từng thuộc tính (Màu sắc + Size):
 * Công thức: [Mã gốc IN HOA][MÀU IN HOA KHÔNG DẤU VIẾT LIỀN][SIZE IN HOA VIẾT LIỀN]
 * - Ví dụ: baseCode = "GASIA221401", color = "Đỏ", size = "38" => "GASIA221401DO38"
 * - Ví dụ: baseCode = "GASIA221401", color = "Đỏ", size = "39" => "GASIA221401DO39"
 * - Nếu tổng chiều dài vượt quá 19 ký tự (khiến mã vạch Code128 tràn khổ tem 35mm), tự động rút gọn phần Màu sắc.
 * - Nếu không có màu và không có size thì trả về baseCode.
 */
export function generateVariantProductCode(
  baseCode: string,
  color?: string,
  size?: string
): string {
  const cleanBase = normalizeToCompactUpperCode(String(baseCode || '').trim());
  if (!cleanBase) return '';
  const rawColorStr = String(color || '').trim();
  const cleanColor = normalizeToCompactUpperCode(rawColorStr);
  const cleanSize = normalizeToCompactUpperCode(String(size || '').trim());
  const fullSuffix = `${cleanColor}${cleanSize}`;
  if (!fullSuffix) return cleanBase;
  if (cleanBase.endsWith(fullSuffix) && cleanBase.length <= 22) return cleanBase;
  const rootBase =
    cleanBase.endsWith(fullSuffix) && cleanBase.length > fullSuffix.length
      ? cleanBase.slice(0, cleanBase.length - fullSuffix.length)
      : cleanBase;

  const fullCode = `${rootBase}${fullSuffix}`;
  if (fullCode.length <= 22) return fullCode;

  const maxColorLen = Math.max(4, 20 - rootBase.length - cleanSize.length);
  const shortColor = buildCompactColorToken(rawColorStr, maxColorLen);
  const shortSuffix = `${shortColor}${cleanSize}`;
  if (rootBase.endsWith(shortSuffix)) return rootBase;
  return `${rootBase}${shortSuffix}`;
}

/**
 * Kiểm tra mã đã đúng chuẩn [Chữ cái Cate][Tên Hãng/NN][6 chữ số] (VD: GASIA221401, GNN221401) hay chưa.
 */
export function isStandardSixDigitProductCode(code?: string): boolean {
  const clean = normalizeToCompactUpperCode(String(code || ''));
  return /^[A-Z]{2,}[0-9]{6}$/.test(clean);
}

/**
 * Sinh 6 chữ số (100000 - 999999) nhất quán từ chuỗi hạt giống (version / size / màu)
 * hoặc ngẫu nhiên nếu không truyền seed.
 */
export function generateSixDigitsFromSeed(seed?: string): string {
  const clean = normalizeToCompactUpperCode(String(seed || ''));
  if (!clean) {
    return String(Math.floor(100000 + Math.random() * 900000));
  }
  let hash = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const num = 100000 + (Math.abs(hash) % 900000);
  return String(num).padStart(6, '0');
}

/**
 * Xác định chữ cái đầu tiên của Category (VD: Giày -> G, Áo -> A, Quần -> Q, Vợt -> V, Bóng -> B, Phụ kiện -> P).
 */
export function resolveCategoryInitial(
  baseName: string,
  categoryCode?: string,
  categoryName?: string
): string {
  const trimmedName = String(baseName || '').trim();

  // 1. Nếu tên sản phẩm bắt đầu trực tiếp bằng từ khóa loại hàng chính (Giày, Áo, Quần, Vợt, Bóng, Phụ kiện)
  if (/^(giày|giay)\b/i.test(trimmedName)) return 'G';
  if (/^(áo|ao)\b/i.test(trimmedName)) return 'A';
  if (/^(quần|quan)\b/i.test(trimmedName) && !/^(quấn\s*cán|quan\s*can)/i.test(trimmedName)) {
    return 'Q';
  }
  if (/^(vợt|vot|váy|vay)\b/i.test(trimmedName)) return 'V';
  if (/^(bóng|bong)\b/i.test(trimmedName)) return 'B';
  if (/^(phụ\s*kiện|phu\s*kien)\b/i.test(trimmedName)) return 'P';

  // 2. Lấy chữ cái đầu tiên của Category được chọn (categoryName hoặc categoryCode)
  const normCatName = normalizeToCompactUpperCode(categoryName || '').replace(/[^A-Z]/g, '');
  if (normCatName.length > 0) {
    return normCatName.charAt(0);
  }
  const normCatCode = normalizeToCompactUpperCode(categoryCode || '').replace(/[^A-Z]/g, '');
  if (normCatCode.length > 0) {
    return normCatCode.charAt(0);
  }

  // 3. Fallback từ các từ khóa đầu tên hàng hoặc chữ cái đầu tiên của tên hàng
  if (/^(balo|ba\s*lô|băng|bang|bộ|bo|bảo\s*vệ|bao\s*ve)\b/i.test(trimmedName)) return 'B';
  if (/^(túi|tui|tất|tat)\b/i.test(trimmedName)) return 'T';
  if (/^(vớ|vo)\b/i.test(trimmedName)) return 'V';
  if (/^(mũ|mu)\b/i.test(trimmedName)) return 'M';
  if (/^(nón|non)\b/i.test(trimmedName)) return 'N';
  if (/^(dép|dep|dán|dan)\b/i.test(trimmedName)) return 'D';
  if (/^(chì|chi|cuốn|cuon|cước|cuoc)\b/i.test(trimmedName)) return 'C';

  const normBaseLetters = normalizeToCompactUpperCode(trimmedName).replace(/[^A-Z]/g, '');
  return normBaseLetters.charAt(0) || 'S';
}

/**
 * Nhận diện Tên Hãng từ cột brand hoặc từ tên sản phẩm.
 * Nếu không có hãng thì trả về { brandCode: 'NN', brandDisplay: '' }.
 */
export function resolveBrandInfo(
  rawName: string,
  explicitBrand?: string
): { brandCode: string; brandDisplay: string } {
  const cleanExplicit = String(explicitBrand || '').trim();
  if (cleanExplicit) {
    const compactExplicit = normalizeToCompactUpperCode(cleanExplicit).replace(/[^A-Z0-9]/g, '');
    if (NO_BRAND_TOKENS.has(compactExplicit)) {
      return { brandCode: 'NN', brandDisplay: '' };
    }
    if (compactExplicit) {
      const matchedKnown = KNOWN_BRANDS.find(
        (b) => b.code === compactExplicit || b.pattern.test(cleanExplicit)
      );
      return {
        brandCode: matchedKnown ? matchedKnown.code : compactExplicit,
        brandDisplay: matchedKnown ? matchedKnown.display : cleanExplicit,
      };
    }
  }

  const cleanName = String(rawName || '').trim();
  if (cleanName) {
    for (const kb of KNOWN_BRANDS) {
      if (kb.pattern.test(cleanName)) {
        return { brandCode: kb.code, brandDisplay: kb.display };
      }
    }
  }

  return { brandCode: 'NN', brandDisplay: '' };
}

function stripColorAndSizeFromClause(clause: string): {
  cleaned: string;
  color: string;
  size: string;
} {
  let working = String(clause || '').trim();
  let detectedSize = '';
  let detectedColor = '';

  // 1. Tách Size tường minh ("size L", "Size: 42", "cỡ XL", "sz M")
  const explicitSizeMatch = working.match(
    /(?:[\s\-\/,]+|^)(?:size|sz|cỡ|co|kích\s*cỡ)\s*[:\-]?\s*(XXS|XS|S|M|L|XL|2XL|3XL|4XL|XXL|XXXL|FREESIZE|FREE\s*SIZE|[234][0-9](?:\.[05])?)\b/i
  );
  if (explicitSizeMatch) {
    detectedSize = explicitSizeMatch[1].replace(/\s+/g, '').toUpperCase();
    working = (
      working.slice(0, explicitSizeMatch.index) +
      working.slice((explicitSizeMatch.index || 0) + explicitSizeMatch[0].length)
    ).trim();
  } else {
    const trailingSizeMatch = working.match(
      /(?:[\-\/,]\s*|\s+)(FREESIZE|FREE\s*SIZE|XXS|XS|XL|2XL|3XL|4XL|XXL|XXXL)\s*$/i
    );
    if (trailingSizeMatch) {
      detectedSize = trailingSizeMatch[1].replace(/\s+/g, '').toUpperCase();
      working = working.slice(0, trailingSizeMatch.index).trim();
    } else {
      const dashSingleSizeMatch = working.match(/(?:[\-\/,]\s*)(S|M|L)\s*$/i);
      if (dashSingleSizeMatch) {
        detectedSize = dashSingleSizeMatch[1].toUpperCase();
        working = working.slice(0, dashSingleSizeMatch.index).trim();
      }
    }
  }

  // 2. Tách Màu tường minh ("màu Đỏ", "color: Blue") hoặc màu ở cuối chuỗi ("- Gray", "Xanh Đen", "Đỏ")
  const explicitColorMatch = working.match(
    /(?:[\s\-\/,]+|^)(?:màu|mau|color)\s*[:\-]?\s*([A-Za-zÀ-ỹ]+(?:\s+[A-Za-zÀ-ỹ]+)?)\s*$/i
  );
  if (explicitColorMatch) {
    detectedColor = explicitColorMatch[1].trim();
    working = working.slice(0, explicitColorMatch.index).trim();
  } else {
    const trailingTokenMatch = working.match(
      /(?:[\-\/,]\s*|\s+|^)(xanh\s*dương|xanh\s*duong|xanh\s*lá|xanh\s*la|xanh\s*đen|xanh\s*den|xanh\s*ngọc|xanh\s*ngoc|đỏ|do|đen|den|trắng|trang|xanh|vàng|vang|hồng|hong|tím|tim|xám|xam|ghi|cam|nâu|nau|kem|bạc|bac|red|blue|pink|gray|grey|white|black|green|yellow|purple|orange|navy|silver|gold)\s*$/i
    );
    if (trailingTokenMatch) {
      const rawColorToken = trailingTokenMatch[1].trim();
      const mapped = KNOWN_COLORS_MAP.find((c) => c.pattern.test(rawColorToken));
      detectedColor =
        /^[a-zA-Z]+$/.test(rawColorToken) &&
        ['gray', 'grey', 'blue', 'pink', 'red', 'purple', 'white', 'black', 'green', 'orange', 'navy'].includes(
          rawColorToken.toLowerCase()
        )
          ? rawColorToken.charAt(0).toUpperCase() + rawColorToken.slice(1).toLowerCase()
          : mapped?.label || rawColorToken;
      working = working.slice(0, trailingTokenMatch.index).trim();
    }
  }

  const cleaned = working.replace(/^[\-\/,:\s]+|[\-\/,:\s]+$/g, '').trim();
  return {
    cleaned,
    color: detectedColor,
    size: detectedSize,
  };
}

/**
 * Tách thông tin Màu sắc, Size, Hãng và sinh Mã sản phẩm chuẩn:
 * - code (Mã gốc): [Chữ cái đầu tiên của Cate] + [Tên Hãng (không có hãng là NN)] + [6 chữ số]
 * - variantCode (Mã con): [code] + [MÀU IN HOA] + [SIZE IN HOA] (VD: GASIA221401DO38)
 */
export function extractVariantFromText(
  rawName: string,
  options?: ProductCodeOptions
): ExtractedProductVariantInfo {
  const raw = String(rawName || '').trim();
  const explicitBrand = options?.brand ? String(options.brand).trim() : '';
  const modelName = options?.modelName ? String(options.modelName).trim() : '';

  if (!raw && !explicitBrand && !modelName) {
    return {
      baseName: '',
      code: '',
      variantCode: '',
      brand: '',
      modelName: '',
      color: '',
      size: '',
      categoryInitial: '',
      brandCode: 'NN',
      sixDigits: '',
    };
  }

  // Nếu truyền object dạng { categoryCode: 'AO', brand: 'Kamito', modelName: 'Pro' } (không có rawName)
  if (!raw && options?.categoryCode && explicitBrand && modelName && !options?.sixDigits && !options?.existingCode) {
    const legacyCode = normalizeToCompactUpperCode(`${options.categoryCode}${explicitBrand}${modelName}`);
    const vCode = generateVariantProductCode(legacyCode, options?.color, options?.size);
    return {
      baseName: `${explicitBrand} ${modelName}`.trim(),
      code: legacyCode,
      variantCode: vCode,
      brand: explicitBrand,
      modelName,
      color: options?.color || '',
      size: options?.size || '',
      categoryInitial: normalizeToCompactUpperCode(options.categoryCode).charAt(0) || 'S',
      brandCode: normalizeToCompactUpperCode(explicitBrand),
      sixDigits: '',
    };
  }

  // Nếu chuỗi đầu vào đã là mã chuẩn [A-Z]{2,}[0-9]{6} (VD: GASIA221401) và không có khoảng trắng
  const compactRaw = normalizeToCompactUpperCode(raw);
  if (
    !/\s/.test(raw) &&
    /^[A-Z]{2,}[0-9]{6}$/.test(compactRaw) &&
    !options?.categoryCode &&
    !options?.categoryName &&
    !explicitBrand
  ) {
    const sixDigits = compactRaw.slice(-6);
    const catInit = compactRaw.charAt(0);
    const bCode = compactRaw.slice(1, -6) || 'NN';
    const c = options?.color || '';
    const s = options?.size || '';
    return {
      baseName: raw,
      code: compactRaw,
      variantCode: generateVariantProductCode(compactRaw, c, s),
      brand: bCode === 'NN' ? '' : bCode,
      modelName,
      color: c,
      size: s,
      categoryInitial: catInit,
      brandCode: bCode,
      sixDigits,
    };
  }

  let detectedSize = options?.size ? String(options.size).trim().toUpperCase() : '';
  let detectedColor = options?.color ? String(options.color).trim() : '';
  let candidateBase = raw;

  const parenMatches = [...raw.matchAll(/\(([^()]+)\)/g)];
  if (parenMatches.length > 0) {
    const lastParen = parenMatches[parenMatches.length - 1];
    const inside = lastParen[1].trim();
    const beforeParen = raw.slice(0, lastParen.index).trim();

    const strippedInside = stripColorAndSizeFromClause(inside);
    const strippedBefore = stripColorAndSizeFromClause(beforeParen);

    detectedColor = detectedColor || strippedInside.color || strippedBefore.color;
    detectedSize = detectedSize || strippedInside.size || strippedBefore.size;
    candidateBase = strippedBefore.cleaned || strippedInside.cleaned || beforeParen || inside;
  } else if (raw) {
    const stripped = stripColorAndSizeFromClause(raw);
    detectedColor = detectedColor || stripped.color;
    detectedSize = detectedSize || stripped.size;
    candidateBase = stripped.cleaned || raw;
  }

  const baseName = candidateBase.replace(/[\-\/,:\s]+$/g, '').trim() || raw;

  // 1. Chữ cái đầu tiên của Category
  const categoryInitial = resolveCategoryInitial(
    baseName || raw,
    options?.categoryCode,
    options?.categoryName
  );

  // 2. Tên Hãng (nếu không có hãng thì là NN)
  const { brandCode, brandDisplay } = resolveBrandInfo(baseName || raw, explicitBrand);

  // 3. 6 chữ số (ưu tiên: options.sixDigits -> 6 số cuối của options.existingCode -> 6 số có sẵn trong tên -> sinh từ seed)
  let sixDigits = '';
  if (options?.sixDigits && /^\d{6}$/.test(options.sixDigits.trim())) {
    sixDigits = options.sixDigits.trim();
  } else if (options?.existingCode) {
    const existingMatch = normalizeToCompactUpperCode(options.existingCode).match(/(\d{6})/);
    if (existingMatch) {
      sixDigits = existingMatch[1];
    }
  }
  if (!sixDigits) {
    const nameSixDigitsMatch = raw.match(/\b(\d{6})\b/) || compactRaw.match(/(\d{6})/);
    if (nameSixDigitsMatch) {
      sixDigits = nameSixDigitsMatch[1];
    }
  }
  if (!sixDigits) {
    const seedParts = [
      baseName || raw,
      modelName,
      options?.seedSuffix || '',
    ]
      .filter(Boolean)
      .join('_');
    sixDigits = generateSixDigitsFromSeed(seedParts);
  }

  const code = `${categoryInitial}${brandCode}${sixDigits}`;
  const variantCode = generateVariantProductCode(code, detectedColor, detectedSize);

  return {
    baseName,
    code,
    variantCode,
    brand: brandDisplay,
    modelName,
    color: detectedColor,
    size: detectedSize,
    categoryInitial,
    brandCode,
    sixDigits,
  };
}

/**
 * Sinh Mã sản phẩm chuẩn 11Sport:
 * Công thức: [Chữ cái đầu của Cate] + [Tên Hãng (không có hãng là NN)] + [6 chữ số]
 * Ví dụ: GASIA221401, GNN221401
 */
export function generateProductCode(
  rawNameOrOptions: string | ProductCodeOptions,
  options?: ProductCodeOptions
): string {
  if (rawNameOrOptions && typeof rawNameOrOptions === 'object') {
    const opts = rawNameOrOptions;
    const rawStr = String(opts.name || '').trim();
    return extractVariantFromText(rawStr, opts).code;
  }

  const rawName = typeof rawNameOrOptions === 'string' ? rawNameOrOptions : '';
  const trimmed = rawName.trim();
  if (!trimmed) {
    if (options?.brand || options?.modelName || options?.categoryCode || options?.categoryName) {
      return extractVariantFromText('', options).code;
    }
    return '';
  }

  if (options?.keepVariantInCode) {
    return normalizeToCompactUpperCode(trimmed);
  }

  const extracted = extractVariantFromText(trimmed, options);
  return extracted.code;
}
