import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { createApp } from '../app';
import {
  connectDatabase,
  disconnectDatabase,
  productRepo,
  customerRepo,
  orderRepo,
  returnExchangeRepo,
  importReceiptRepo,
} from '../config/db';
import { seedDatabaseIfNeeded } from '../config/seed';

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
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/11sport';
  if (!uri.includes('127.0.0.1') && !uri.includes('localhost')) {
    throw new Error(
      `[SAFETY ABORT] MONGODB_URI (${uri}) không phải Local! Chỉ chạy seedDevData trên Local DB.`
    );
  }

  const mode = await connectDatabase();
  await seedDatabaseIfNeeded();
  console.log(`[Seed Dev] Connected to Local DB (${mode})`);

  // Làm sạch các đơn hàng/khách hàng/đổi trả mẫu cũ trước khi tạo mới
  const oldOrders = await orderRepo.find({});
  for (const o of oldOrders) await orderRepo.deleteById(o._id);
  const oldCustomers = await customerRepo.find({});
  for (const c of oldCustomers) await customerRepo.deleteById(c._id);
  const oldReturns = await returnExchangeRepo.find({});
  for (const r of oldReturns) await returnExchangeRepo.deleteById(r._id);

  // Xóa phiếu nhập nháp PN-0003 nếu đã tạo trước đó
  const oldImports = await importReceiptRepo.find({});
  for (const imp of oldImports) {
    if (imp.status !== 'COMPLETED') {
      await importReceiptRepo.deleteById(imp._id);
    }
  }

  // Cập nhật costPrice mẫu (~65% giá bán) & barcode mẫu cho các sản phẩm để test lợi nhuận và quét mã vạch
  const allProducts = await productRepo.find({});
  let barcodeIndex = 8938505970001;
  for (const p of allProducts) {
    const sellingPrice = Number(p.sellingPrice) || 0;
    const sampleCost = sellingPrice > 0 ? Math.round((sellingPrice * 0.65) / 1000) * 1000 : 0;
    const sampleBarcode = p.barcode || String(barcodeIndex++);
    await productRepo.updateById(p._id, {
      costPrice: sampleCost,
      barcode: sampleBarcode,
    });
  }
  console.log(`[Seed Dev] Updated costPrice & barcode for ${allProducts.length} products.`);

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

  try {
    const productsRes = await apiCall(baseUrl, '/products', 'GET');
    const products: any[] = productsRes.data || [];
    const findProd = (nameSub: string) =>
      products.find(
        (p) =>
          p.name.toLowerCase().includes(nameSub.toLowerCase()) &&
          Number(p.stockFloor1) > 2 &&
          Number(p.sellingPrice) > 0
      );

    const pFusion = findProd('Pikdy Fusion') || products[0];
    const pFocus = findProd('Pikdy Focus') || products[1];
    const pStrive = findProd('Pikdy Strive') || products[2];
    const pBall = findProd('Thunder box 3') || products[3];
    const pShoe = findProd('Asics COURT FF 3') || products[4];
    const pGrip = findProd('Dalton Cuốn cán') || products[5];

    // 1. Tạo 4 đơn hàng mẫu (đa dạng phương thức thanh toán & chiết khấu)
    const order1 = await apiCall(baseUrl, '/orders', 'POST', {
      customerName: 'Nguyễn Minh Tuấn',
      customerPhone: '0901234567',
      paymentMethod: 'BANKING',
      hasCardFee: false,
      billDiscountType: 'PERCENT',
      billDiscountValue: 5,
      note: 'Khách VIP mua combo vợt + bóng (Giảm 5% tổng bill)',
      items: [
        { productId: pFusion._id, quantity: 1, discountType: 'NONE', discountValue: 0 },
        { productId: pBall._id, quantity: 2, discountType: 'NONE', discountValue: 0 },
      ],
    });
    console.log(`[Seed Dev] Created Order 1: ${order1.data.orderCode}`);

    const order2 = await apiCall(baseUrl, '/orders', 'POST', {
      customerName: 'Trần Thị Thu Hà',
      customerPhone: '0912345678',
      paymentMethod: 'CASH',
      hasCardFee: false,
      billDiscountType: 'NONE',
      billDiscountValue: 0,
      note: 'Khách lẻ mua tại quầy Tầng 1',
      items: [
        { productId: pFocus._id, quantity: 1, discountType: 'AMOUNT', discountValue: 100000 },
        { productId: pGrip._id, quantity: 2, discountType: 'NONE', discountValue: 0 },
      ],
    });
    console.log(`[Seed Dev] Created Order 2: ${order2.data.orderCode}`);

    const order3 = await apiCall(baseUrl, '/orders', 'POST', {
      customerName: 'Lê Hoàng Nam',
      customerPhone: '0987654321',
      paymentMethod: 'CARD',
      hasCardFee: true,
      billDiscountType: 'NONE',
      billDiscountValue: 0,
      note: 'Quẹt thẻ POS (có phí cà thẻ)',
      items: [
        { productId: pShoe._id, quantity: 1, discountType: 'NONE', discountValue: 0 },
        { productId: pStrive._id, quantity: 1, discountType: 'NONE', discountValue: 0 },
      ],
    });
    console.log(`[Seed Dev] Created Order 3: ${order3.data.orderCode}`);

    const order4 = await apiCall(baseUrl, '/orders', 'POST', {
      customerName: 'Phạm Quốc Bảo',
      customerPhone: '0933445566',
      paymentMethod: 'BANKING',
      hasCardFee: false,
      billDiscountType: 'AMOUNT',
      billDiscountValue: 50000,
      note: 'Khách quen mua thêm phụ kiện',
      items: [{ productId: pBall._id, quantity: 3, discountType: 'NONE', discountValue: 0 }],
    });
    console.log(`[Seed Dev] Created Order 4: ${order4.data.orderCode}`);

    // 2. Tạo 1 phiếu Đổi/Trả mẫu trên Order 2
    const retRes = await apiCall(baseUrl, '/returns', 'POST', {
      orderId: order2.data._id,
      returnItems: [
        {
          productId: pGrip._id,
          quantity: 1,
          condition: 'GOOD',
        },
      ],
      exchangeItems: [
        {
          productId: pBall._id,
          quantity: 1,
        },
      ],
      refundMethod: 'CASH',
      note: 'Khách đổi 1 cuốn cán sang 1 hộp bóng Thunder',
    });
    console.log(`[Seed Dev] Created Return/Exchange: ${retRes.data.code}`);

    // 3. Tạo 1 Phiếu Nhập Kho đang ở trạng thái CHECKING (PN-0003) để test tính năng kiểm kho / quét tag
    const checkImport = await apiCall(baseUrl, '/imports', 'POST', {
      targetWarehouse: 'FLOOR_1',
      defaultCategoryId: pFusion.categoryId,
      note: 'Lô hàng mới về đang chờ kiểm đếm & quét tag (Seed Dev)',
      items: [
        {
          stt: 1,
          productId: pFusion._id,
          productCode: pFusion.code,
          productName: pFusion.name,
          categoryId: pFusion.categoryId,
          unit: pFusion.unit,
          expectedQuantity: 10,
          actualQuantity: 10,
          scannedQuantity: 4,
          costPrice: pFusion.costPrice || 2730000,
          isChecked: false,
          isConfirmed: false,
          note: 'Đã quét 4/10 cây',
        },
        {
          stt: 2,
          productId: pFocus._id,
          productCode: pFocus.code,
          productName: pFocus.name,
          categoryId: pFocus.categoryId,
          unit: pFocus.unit,
          expectedQuantity: 5,
          actualQuantity: 5,
          scannedQuantity: 5,
          costPrice: pFocus.costPrice || 2275000,
          isChecked: true,
          isConfirmed: true,
          note: 'Đã kiểm đủ 5/5 cây',
        },
      ],
    });
    console.log(`[Seed Dev] Created Pending Import Receipt: ${checkImport.data.code}`);
  } finally {
    server.close();
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error('[Seed Dev Error]', err);
  process.exit(1);
});
