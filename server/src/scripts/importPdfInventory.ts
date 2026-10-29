import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { createApp } from '../app';
import {
  connectDatabase,
  disconnectDatabase,
  productRepo,
  stockMovementRepo,
  importReceiptRepo,
} from '../config/db';
import { seedDatabaseIfNeeded } from '../config/seed';

interface PdfItemRow {
  category: 'Vợt' | 'Bóng thi đấu' | 'Phụ kiện';
  brand: string;
  model: string;
  unit: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  /** Nếu tên hiển thị ở Tầng 2 viết đảo (VD "Tất Pikdy" so với "Pikdy Tất" ở Tầng 1) thì map về đúng tên chuẩn Tầng 1 */
  canonicalName?: string;
}

const FLOOR_1_ITEMS: PdfItemRow[] = [
  // ==================== 1. VỢT (26 dòng - Tổng SL Tầng 1 = 151) ====================
  { category: 'Vợt', brand: 'Pikdy', model: 'Fusion', unit: 'Cái', quantity: 36, costPrice: 0, sellingPrice: 4200000 },
  { category: 'Vợt', brand: 'Pikdy', model: 'Focus', unit: 'Cái', quantity: 20, costPrice: 0, sellingPrice: 3500000 },
  { category: 'Vợt', brand: 'Pikdy', model: 'Strive', unit: 'Cái', quantity: 28, costPrice: 0, sellingPrice: 3000000 },
  { category: 'Vợt', brand: 'Pikdy', model: 'Lucky', unit: 'Cái', quantity: 0, costPrice: 0, sellingPrice: 790000 },
  { category: 'Vợt', brand: 'SYPIK', model: 'Triton 5-Gray', unit: 'Cái', quantity: 4, costPrice: 0, sellingPrice: 4500000 },
  { category: 'Vợt', brand: 'SYPIK', model: 'Triton 5 - Blue', unit: 'Cái', quantity: 4, costPrice: 0, sellingPrice: 4500000 },
  { category: 'Vợt', brand: 'SYPIK', model: 'Triton 5 - Pink', unit: 'Cái', quantity: 4, costPrice: 0, sellingPrice: 4500000 },
  { category: 'Vợt', brand: 'RPM', model: 'JADE', unit: 'Cái', quantity: 5, costPrice: 0, sellingPrice: 5600000 },
  { category: 'Vợt', brand: 'RPM', model: 'Q2-Purple', unit: 'Cái', quantity: 0, costPrice: 0, sellingPrice: 5200000 },
  { category: 'Vợt', brand: 'RPM', model: 'V2-Red', unit: 'Cái', quantity: 1, costPrice: 0, sellingPrice: 5200000 },
  { category: 'Vợt', brand: 'RPM', model: 'V2-Pink', unit: 'Cái', quantity: 2, costPrice: 0, sellingPrice: 5200000 },
  { category: 'Vợt', brand: 'RPM', model: 'Q2 Limited Edition', unit: 'Cái', quantity: 1, costPrice: 0, sellingPrice: 6000000 },
  { category: 'Vợt', brand: 'Joola', model: 'Perseus 4', unit: 'Cái', quantity: 1, costPrice: 0, sellingPrice: 5000000 },
  { category: 'Vợt', brand: 'Joola', model: 'Magnus 3S', unit: 'Cái', quantity: 1, costPrice: 0, sellingPrice: 4500000 },
  { category: 'Vợt', brand: 'Selkirk', model: 'SLK', unit: 'Cái', quantity: 7, costPrice: 0, sellingPrice: 3000000 },
  { category: 'Vợt', brand: 'Selkirk', model: 'Omini Calypso', unit: 'Cái', quantity: 1, costPrice: 0, sellingPrice: 7000000 },
  { category: 'Vợt', brand: 'Selkirk', model: 'Omni Canyon', unit: 'Cái', quantity: 2, costPrice: 0, sellingPrice: 7000000 },
  { category: 'Vợt', brand: 'Selkirk', model: 'Widebody Hydro', unit: 'Cái', quantity: 3, costPrice: 0, sellingPrice: 7000000 },
  { category: 'Vợt', brand: 'Kamito', model: 'Alpha Her Power', unit: 'Cái', quantity: 2, costPrice: 0, sellingPrice: 5200000 },
  { category: 'Vợt', brand: 'Kamito', model: 'Alpha X 3 Sao', unit: 'Cái', quantity: 7, costPrice: 0, sellingPrice: 5200000 },
  { category: 'Vợt', brand: 'Paddletek', model: 'Bantan TKO-C 14.3mm', unit: 'Cái', quantity: 1, costPrice: 0, sellingPrice: 4900000 },
  { category: 'Vợt', brand: 'Paddletek', model: 'ALW-C 14.3mm', unit: 'Cái', quantity: 2, costPrice: 0, sellingPrice: 4900000 },
  { category: 'Vợt', brand: 'Jogabola', model: 'Solus', unit: 'Cái', quantity: 4, costPrice: 0, sellingPrice: 4100000 },
  { category: 'Vợt', brand: 'Thunder', model: 'Typhoon III', unit: 'Cái', quantity: 7, costPrice: 0, sellingPrice: 3500000 },
  { category: 'Vợt', brand: 'Kaitashi', model: 'Suwa', unit: 'Cái', quantity: 1, costPrice: 0, sellingPrice: 4800000 },
  { category: 'Vợt', brand: 'Wiro', model: 'T700', unit: 'Cái', quantity: 7, costPrice: 0, sellingPrice: 850000 },

  // ==================== 2. BÓNG THI ĐẤU (11 dòng - Quả: 0, Hộp: 168) ====================
  { category: 'Bóng thi đấu', brand: 'Facolos', model: 'F Eco', unit: 'Quả', quantity: 0, costPrice: 0, sellingPrice: 40000 },
  { category: 'Bóng thi đấu', brand: 'Facolos', model: 'F Pro 2', unit: 'Quả', quantity: 0, costPrice: 0, sellingPrice: 50000 },
  { category: 'Bóng thi đấu', brand: 'Pikdy', model: 'ghép', unit: 'Quả', quantity: 0, costPrice: 0, sellingPrice: 35000 },
  { category: 'Bóng thi đấu', brand: 'Facolos', model: 'F Eco', unit: 'Hộp', quantity: 22, costPrice: 0, sellingPrice: 120000 },
  { category: 'Bóng thi đấu', brand: 'Facolos', model: 'F Pro 2', unit: 'Hộp', quantity: 0, costPrice: 0, sellingPrice: 150000 },
  { category: 'Bóng thi đấu', brand: 'Pikdy', model: 'ghép', unit: 'Hộp', quantity: 17, costPrice: 0, sellingPrice: 100000 },
  { category: 'Bóng thi đấu', brand: 'Thunder', model: 'box 3', unit: 'Hộp', quantity: 30, costPrice: 0, sellingPrice: 140000 },
  { category: 'Bóng thi đấu', brand: 'Thunder', model: 'box 6', unit: 'Hộp', quantity: 1, costPrice: 0, sellingPrice: 280000 },
  { category: 'Bóng thi đấu', brand: 'Động lực', model: '40 lỗ', unit: 'Hộp', quantity: 50, costPrice: 0, sellingPrice: 140000 },
  { category: 'Bóng thi đấu', brand: 'Zocker', model: 'Five star gen 2', unit: 'Hộp', quantity: 19, costPrice: 0, sellingPrice: 160000 },
  { category: 'Bóng thi đấu', brand: 'Soxter', model: 'Tiger One', unit: 'Hộp', quantity: 29, costPrice: 0, sellingPrice: 105000 },

  // ==================== 3. PHỤ KIỆN - BẢNG 1 (26 dòng) ====================
  { category: 'Phụ kiện', brand: 'Pikdy', model: 'Tất', unit: 'Cái', quantity: 6, costPrice: 0, sellingPrice: 40000 },
  { category: 'Phụ kiện', brand: 'Bảo vệ mặt vợt', model: '11 SPORT', unit: 'Cái', quantity: 127, costPrice: 0, sellingPrice: 40000 },
  { category: 'Phụ kiện', brand: 'Dán viền', model: '', unit: 'Hộp', quantity: 0, costPrice: 0, sellingPrice: 25000 },
  { category: 'Phụ kiện', brand: 'Ligpro', model: 'Vệ sinh mặt vợt', unit: 'Hộp', quantity: 27, costPrice: 0, sellingPrice: 135000 },
  { category: 'Phụ kiện', brand: 'Lippro', model: 'Xịt lạnh 160ml', unit: 'Chai', quantity: 2, costPrice: 0, sellingPrice: 90000 },
  { category: 'Phụ kiện', brand: 'Lippro', model: 'Xịt lạnh siêu tốc 200ml', unit: 'Chai', quantity: 2, costPrice: 0, sellingPrice: 130000 },
  { category: 'Phụ kiện', brand: 'Ligpro', model: 'Xịt khử mùi giày 200ml', unit: 'Chai', quantity: 1, costPrice: 0, sellingPrice: 130000 },
  { category: 'Phụ kiện', brand: 'Ligpro', model: 'Pro Xtreme', unit: 'Chai', quantity: 12, costPrice: 0, sellingPrice: 140000 },
  { category: 'Phụ kiện', brand: 'Ligpro', model: 'Xịt nóng 100ml', unit: 'Chai', quantity: 13, costPrice: 0, sellingPrice: 90000 },
  { category: 'Phụ kiện', brand: 'Ligpro', model: 'Xịt nóng 200ml', unit: 'Chai', quantity: 3, costPrice: 0, sellingPrice: 130000 },
  { category: 'Phụ kiện', brand: 'Picko In', model: 'Paddle Cleaner', unit: 'Chai', quantity: 16, costPrice: 0, sellingPrice: 170000 },
  { category: 'Phụ kiện', brand: 'Dalton', model: 'Cuốn cán', unit: 'Hộp', quantity: 17, costPrice: 0, sellingPrice: 600000 },
  { category: 'Phụ kiện', brand: 'Facolos', model: 'Balo', unit: 'Cái', quantity: 2, costPrice: 0, sellingPrice: 2800000 },
  { category: 'Phụ kiện', brand: 'CRBN', model: 'Balo', unit: 'Cái', quantity: 3, costPrice: 0, sellingPrice: 2900000 },
  { category: 'Phụ kiện', brand: 'Pickleballo', model: 'Túi xách', unit: 'Cái', quantity: 5, costPrice: 0, sellingPrice: 420000 },
  { category: 'Phụ kiện', brand: 'Pili', model: 'Túi tò te', unit: 'Cái', quantity: 2, costPrice: 0, sellingPrice: 150000 },
  { category: 'Phụ kiện', brand: 'Pili', model: 'mũ', unit: 'Cái', quantity: 1, costPrice: 0, sellingPrice: 350000 },
  { category: 'Phụ kiện', brand: 'Pili', model: 'Băng đầu thể thao', unit: 'Cái', quantity: 7, costPrice: 0, sellingPrice: 100000 },
  { category: 'Phụ kiện', brand: 'Pili', model: 'Băng đeo cổ tay thể thao', unit: 'Cái', quantity: 1, costPrice: 0, sellingPrice: 140000 },
  { category: 'Phụ kiện', brand: 'Pili', model: 'Tất', unit: 'Cái', quantity: 29, costPrice: 0, sellingPrice: 250000 },
  { category: 'Phụ kiện', brand: 'Mũ thể thao', model: '', unit: 'Cái', quantity: 16, costPrice: 0, sellingPrice: 280000 },
  { category: 'Phụ kiện', brand: 'Mũ nam', model: '', unit: 'Cái', quantity: 1, costPrice: 0, sellingPrice: 60000 },
  { category: 'Phụ kiện', brand: 'GOODFIT', model: 'GF403E', unit: 'Cái', quantity: 10, costPrice: 0, sellingPrice: 100000 },
  { category: 'Phụ kiện', brand: 'GOODFIT', model: 'GF402E-L', unit: 'Cái', quantity: 9, costPrice: 0, sellingPrice: 130000 },
  { category: 'Phụ kiện', brand: 'Chì dán vợt', model: '', unit: 'Cuộn', quantity: 41, costPrice: 0, sellingPrice: 90000 },
  { category: 'Phụ kiện', brand: 'Dalton', model: 'Cuốn cán', unit: 'Cái', quantity: 252, costPrice: 0, sellingPrice: 15000 },

  // ==================== 4. PHỤ KIỆN / GIÀY - BẢNG 2 (21 dòng - Tổng SL = 106 Đôi) ====================
  { category: 'Phụ kiện', brand: 'Asics', model: 'COURT FF 3', unit: 'Đôi', quantity: 17, costPrice: 0, sellingPrice: 4199000 },
  { category: 'Phụ kiện', brand: 'Asics', model: 'SOLUTION SPEED FF4', unit: 'Đôi', quantity: 11, costPrice: 0, sellingPrice: 3499000 },
  { category: 'Phụ kiện', brand: 'Asics', model: 'RESOLUTION X', unit: 'Đôi', quantity: 14, costPrice: 0, sellingPrice: 3999000 },
  { category: 'Phụ kiện', brand: 'Wika', model: 'VANTA', unit: 'Đôi', quantity: 7, costPrice: 0, sellingPrice: 1399000 },
  { category: 'Phụ kiện', brand: 'Wika', model: 'MERIK', unit: 'Đôi', quantity: 1, costPrice: 0, sellingPrice: 1599000 },
  { category: 'Phụ kiện', brand: 'Lotto', model: 'MIRAGE 200', unit: 'Đôi', quantity: 3, costPrice: 0, sellingPrice: 3299000 },
  { category: 'Phụ kiện', brand: 'Lotto', model: 'MIRAGE 300', unit: 'Đôi', quantity: 7, costPrice: 0, sellingPrice: 2599000 },
  { category: 'Phụ kiện', brand: 'Lotto', model: 'MIRAGE 400', unit: 'Đôi', quantity: 2, costPrice: 0, sellingPrice: 1899000 },
  { category: 'Phụ kiện', brand: 'Lotto', model: 'MIRAGE 700', unit: 'Đôi', quantity: 10, costPrice: 0, sellingPrice: 1839000 },
  { category: 'Phụ kiện', brand: 'Lotto', model: 'GARRET', unit: 'Đôi', quantity: 1, costPrice: 0, sellingPrice: 1430000 },
  { category: 'Phụ kiện', brand: 'Jogabola', model: 'PANTO I', unit: 'Đôi', quantity: 7, costPrice: 0, sellingPrice: 1990000 },
  { category: 'Phụ kiện', brand: 'Jogabola', model: 'VORTEX', unit: 'Đôi', quantity: 4, costPrice: 0, sellingPrice: 1990000 },
  { category: 'Phụ kiện', brand: 'Jogabola', model: 'VENTO', unit: 'Đôi', quantity: 8, costPrice: 0, sellingPrice: 1990000 },
  { category: 'Phụ kiện', brand: 'Jogabola', model: 'RANGER', unit: 'Đôi', quantity: 3, costPrice: 0, sellingPrice: 1050000 },
  { category: 'Phụ kiện', brand: 'Jogabola', model: 'TERRA', unit: 'Đôi', quantity: 0, costPrice: 0, sellingPrice: 1490000 },
  { category: 'Phụ kiện', brand: 'Jogabola', model: 'ENDURO', unit: 'Đôi', quantity: 1, costPrice: 0, sellingPrice: 1050000 },
  { category: 'Phụ kiện', brand: 'Jogabola', model: 'BUBBLE J', unit: 'Đôi', quantity: 4, costPrice: 0, sellingPrice: 1150000 },
  { category: 'Phụ kiện', brand: 'Promax', model: 'Pickleball PI89', unit: 'Đôi', quantity: 1, costPrice: 0, sellingPrice: 890000 },
  { category: 'Phụ kiện', brand: 'Zocker', model: 'ASPIRE', unit: 'Đôi', quantity: 2, costPrice: 0, sellingPrice: 1450000 },
  { category: 'Phụ kiện', brand: 'Mizuno', model: 'Wave enforce tour 2 AC', unit: 'Đôi', quantity: 1, costPrice: 0, sellingPrice: 3600000 },
  { category: 'Phụ kiện', brand: 'Kamito', model: 'SLIDE PRO', unit: 'Đôi', quantity: 2, costPrice: 0, sellingPrice: 1490000 },
];

const FLOOR_2_ITEMS: PdfItemRow[] = [
  // ==================== KHO TẦNG 2 (14 dòng) ====================
  { category: 'Vợt', brand: 'Pikdy', model: 'Fusion', unit: 'Cái', quantity: 302, costPrice: 0, sellingPrice: 0 },
  { category: 'Vợt', brand: 'Pikdy', model: 'Focus', unit: 'Cái', quantity: 73, costPrice: 0, sellingPrice: 0 },
  { category: 'Vợt', brand: 'Pikdy', model: 'Strive', unit: 'Cái', quantity: 201, costPrice: 0, sellingPrice: 0 },
  { category: 'Vợt', brand: 'SYPIK', model: 'Triton 5-Gray', unit: 'Cái', quantity: 16, costPrice: 0, sellingPrice: 0 },
  { category: 'Vợt', brand: 'SYPIK', model: 'Triton 5 - Blue', unit: 'Cái', quantity: 9, costPrice: 0, sellingPrice: 0 },
  { category: 'Vợt', brand: 'SYPIK', model: 'Triton 5 - Pink', unit: 'Cái', quantity: 10, costPrice: 0, sellingPrice: 0 },
  { category: 'Vợt', brand: 'Pikdy', model: 'Lucky', unit: 'Cái', quantity: 0, costPrice: 0, sellingPrice: 0 },
  { category: 'Bóng thi đấu', brand: 'Facolos', model: 'F Eco', unit: 'Quả', quantity: 60, costPrice: 0, sellingPrice: 0 },
  {
    category: 'Bóng thi đấu',
    brand: 'Facolos F Pro 2',
    model: 'F Pro 2',
    unit: 'Quả',
    quantity: 99,
    costPrice: 0,
    sellingPrice: 0,
    canonicalName: 'Facolos F Pro 2',
  },
  { category: 'Bóng thi đấu', brand: 'Pikdy', model: 'ghép', unit: 'Quả', quantity: 1371, costPrice: 0, sellingPrice: 0 },
  { category: 'Bóng thi đấu', brand: 'Thunder', model: 'box 3', unit: 'Hộp', quantity: 45, costPrice: 0, sellingPrice: 0 },
  { category: 'Bóng thi đấu', brand: 'Soxter', model: 'Tiger One', unit: 'Quả', quantity: 116, costPrice: 0, sellingPrice: 0 },
  {
    category: 'Phụ kiện',
    brand: 'Tất Pikdy',
    model: '',
    unit: 'Cái',
    quantity: 332,
    costPrice: 0,
    sellingPrice: 0,
    canonicalName: 'Pikdy Tất',
  },
  { category: 'Phụ kiện', brand: 'Bảo vệ mặt vợt', model: '11 SPORT', unit: 'Cái', quantity: 146, costPrice: 0, sellingPrice: 0 },
  { category: 'Phụ kiện', brand: 'Dán viền', model: '', unit: 'Hộp', quantity: 3, costPrice: 0, sellingPrice: 0 },
];

function buildProductName(row: PdfItemRow): string {
  if (row.canonicalName) return row.canonicalName;
  const b = row.brand.trim();
  const m = row.model.trim();
  return m ? `${b} ${m}` : b;
}

async function apiCall(baseUrl: string, path: string, method: string, body?: any) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'admin',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`API ${method} ${path} failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

async function main() {
  const mode = await connectDatabase();
  await seedDatabaseIfNeeded();
  console.log(`[Import PDF] Database connected in mode: ${mode}`);

  // Làm sạch dữ liệu sản phẩm/phiếu nhập/sổ kho cũ (hiện tại products = 0) để import chuẩn 100%
  const existingProducts = await productRepo.find({});
  for (const p of existingProducts) await productRepo.deleteById(p._id);
  const existingMovements = await stockMovementRepo.find({});
  for (const m of existingMovements) await stockMovementRepo.deleteById(m._id);
  const existingImports = await importReceiptRepo.find({});
  for (const r of existingImports) await importReceiptRepo.deleteById(r._id);

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  console.log(`[Import PDF] Local API server started at ${baseUrl}`);

  try {
    // 1. Tạo / lấy Category qua API (GET & POST /api/v1/categories)
    const catListRes = await apiCall(baseUrl, '/categories', 'GET');
    const existingCats: any[] = catListRes.data || [];
    const categoryIdByName = new Map<string, string>();
    for (const c of existingCats) {
      categoryIdByName.set(String(c.name).trim().toLowerCase(), c._id);
    }

    const requiredCategories = [
      { code: 'VOT', name: 'Vợt' },
      { code: 'BONG_THI_DAU', name: 'Bóng thi đấu' },
      { code: 'PHU_KIEN', name: 'Phụ kiện' },
    ];

    for (const reqCat of requiredCategories) {
      const key = reqCat.name.toLowerCase();
      if (!categoryIdByName.has(key)) {
        const created = await apiCall(baseUrl, '/categories', 'POST', reqCat);
        categoryIdByName.set(key, created.data._id);
        console.log(`[Category] Created via API: ${reqCat.name} (${reqCat.code}) -> ${created.data._id}`);
      } else {
        console.log(`[Category] Already exists: ${reqCat.name} -> ${categoryIdByName.get(key)}`);
      }
    }

    // 2. Tạo danh mục Sản phẩm & Giá bán ở Kho Tầng 1 trước với quantity = 0 qua POST /api/v1/products,
    //    sau đó lập Phiếu Nhập Kho Tầng 1 (POST /api/v1/imports + POST /api/v1/imports/:id/complete)
    //    để vừa có đầy đủ Sản phẩm (kể cả dòng SL = 0), Giá bán, Tồn Tầng 1, vừa có Phiếu Nhập Kho PN-0001!
    const productKeyToCode = new Map<string, string>(); // key = `${name.toLowerCase()}__${unit.toLowerCase()}`

    for (const row of FLOOR_1_ITEMS) {
      const name = buildProductName(row);
      const catId = categoryIdByName.get(row.category.toLowerCase())!;
      const created = await apiCall(baseUrl, '/products', 'POST', {
        name,
        categoryId: catId,
        unit: row.unit,
        quantity: 0,
        targetWarehouse: 'FLOOR_1',
        costPrice: row.costPrice,
        sellingPrice: row.sellingPrice,
        upsertIfExists: true,
      });
      const prod = created.data;
      const key = `${name.toLowerCase()}__${row.unit.trim().toLowerCase()}`;
      productKeyToCode.set(key, prod.code);
    }

    // Lập Phiếu Nhập Kho Tầng 1 (FLOOR_1) qua API POST /api/v1/imports & /complete
    const floor1ReceiptItems = FLOOR_1_ITEMS.map((row, idx) => {
      const name = buildProductName(row);
      const key = `${name.toLowerCase()}__${row.unit.trim().toLowerCase()}`;
      const productCode = productKeyToCode.get(key)!;
      const catId = categoryIdByName.get(row.category.toLowerCase())!;
      return {
        stt: idx + 1,
        productCode,
        productName: name,
        categoryId: catId,
        unit: row.unit,
        expectedQuantity: row.quantity,
        actualQuantity: row.quantity,
        costPrice: row.costPrice,
        isChecked: true,
        isConfirmed: true,
        note: `Kho Tầng 1 - ${row.category}`,
      };
    });

    const f1CreateRes = await apiCall(baseUrl, '/imports', 'POST', {
      targetWarehouse: 'FLOOR_1',
      defaultCategoryId: categoryIdByName.get('vợt'),
      note: 'Nhập dữ liệu tồn kho ban đầu - Quản lý kho - Kho tầng 1',
      items: floor1ReceiptItems,
    });
    const f1ReceiptId = f1CreateRes.data._id;
    const f1CompleteRes = await apiCall(baseUrl, `/imports/${f1ReceiptId}/complete`, 'POST', {
      targetWarehouse: 'FLOOR_1',
      items: floor1ReceiptItems,
    });
    console.log(
      `[Import FLOOR_1] Completed receipt ${f1CompleteRes.data.receipt.code} with ${floor1ReceiptItems.length} rows.`
    );

    // 3. Đảm bảo sản phẩm mới chỉ xuất hiện ở Kho Tầng 2 (VD Soxter Tiger One ĐVT Quả) cũng được tạo đúng Category
    for (const row of FLOOR_2_ITEMS) {
      const name = buildProductName(row);
      const key = `${name.toLowerCase()}__${row.unit.trim().toLowerCase()}`;
      if (!productKeyToCode.has(key)) {
        const catId = categoryIdByName.get(row.category.toLowerCase())!;
        const created = await apiCall(baseUrl, '/products', 'POST', {
          name,
          categoryId: catId,
          unit: row.unit,
          quantity: 0,
          targetWarehouse: 'FLOOR_2',
          costPrice: row.costPrice,
          sellingPrice: row.sellingPrice,
          upsertIfExists: true,
        });
        productKeyToCode.set(key, created.data.code);
      }
    }

    // Lập Phiếu Nhập Kho Tầng 2 (FLOOR_2) qua API POST /api/v1/imports & /complete
    const floor2ReceiptItems = FLOOR_2_ITEMS.map((row, idx) => {
      const name = buildProductName(row);
      const key = `${name.toLowerCase()}__${row.unit.trim().toLowerCase()}`;
      const productCode = productKeyToCode.get(key)!;
      const catId = categoryIdByName.get(row.category.toLowerCase())!;
      return {
        stt: idx + 1,
        productCode,
        productName: name,
        categoryId: catId,
        unit: row.unit,
        expectedQuantity: row.quantity,
        actualQuantity: row.quantity,
        costPrice: row.costPrice,
        isChecked: true,
        isConfirmed: true,
        note: `Kho Tầng 2 - ${row.category}`,
      };
    });

    const f2CreateRes = await apiCall(baseUrl, '/imports', 'POST', {
      targetWarehouse: 'FLOOR_2',
      defaultCategoryId: categoryIdByName.get('vợt'),
      note: 'Nhập dữ liệu tồn kho ban đầu - Quản lý kho - Kho tầng 2',
      items: floor2ReceiptItems,
    });
    const f2ReceiptId = f2CreateRes.data._id;
    const f2CompleteRes = await apiCall(baseUrl, `/imports/${f2ReceiptId}/complete`, 'POST', {
      targetWarehouse: 'FLOOR_2',
      items: floor2ReceiptItems,
    });
    console.log(
      `[Import FLOOR_2] Completed receipt ${f2CompleteRes.data.receipt.code} with ${floor2ReceiptItems.length} rows.`
    );

    // 4. Kiểm tra tổng kết qua GET /api/v1/products
    const finalProductsRes = await apiCall(baseUrl, '/products', 'GET');
    const finalProducts: any[] = finalProductsRes.data || [];
    const totalF1 = finalProducts.reduce((s, p) => s + (Number(p.stockFloor1) || 0), 0);
    const totalF2 = finalProducts.reduce((s, p) => s + (Number(p.stockFloor2) || 0), 0);
    const totalStock = finalProducts.reduce((s, p) => s + (Number(p.stock) || 0), 0);

    console.log('====================================================');
    console.log(`[SUMMARY] Total Products (SKU): ${finalProducts.length}`);
    console.log(`[SUMMARY] Total Stock Floor 1 : ${totalF1}`);
    console.log(`[SUMMARY] Total Stock Floor 2 : ${totalF2}`);
    console.log(`[SUMMARY] Total Combined Stock: ${totalStock}`);
    console.log('====================================================');
  } finally {
    server.close();
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error('[Import PDF Error]', err);
  process.exit(1);
});
