import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase, disconnectDatabase } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';
import {
  estimateCode128Dots,
  generateProductCode,
  generateVariantProductCode,
  isCompactBarcodeMatchVariant,
  toCompactBarcode128,
} from '../src/utils/productCode';
import { encodeCode128BPattern, encodeCode128RawPattern } from '../src/utils/windowsPrinter';
import { isScannedCodeMatchServer, matchTagToItems } from '../src/utils/tagMatch';

const app = createApp();

describe('v2.8 & v3.2: Mã gốc + Mã con theo thuộc tính (variantCode = [RootCode][COLOR][SIZE]), Quản lý biến thể & Import PDF/Excel', () => {
  let aoCatId = '';

  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
    await clearDatabase();
    await seedDatabaseIfNeeded();

    const catRes = await request(app)
      .post('/api/v1/categories')
      .set('x-user-id', 'admin')
      .send({ code: 'AO', name: 'Áo thể thao' });
    aoCatId = catRes.body.data._id;
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('Sinh mã gốc IN HOA VIẾT LIỀN và Mã con thuộc tính (VD: GASIA221401 -> GASIA221401DO38, GASIA221401DO39)', () => {
    // Cùng dòng sản phẩm khác màu/size sinh ra cùng 1 Mã gốc 6 chữ số
    const rootCode1 = generateProductCode('Áo Kamito Pro (Áo Kamito Pro Đỏ size L)');
    const rootCode2 = generateProductCode('Áo Kamito Pro (Áo Kamito Pro Xanh Đen size XL)');
    expect(rootCode1).toBe(rootCode2);
    expect(rootCode1).toMatch(/^AKAMITO\d{6}$/);

    // Sinh mã con theo thuộc tính (Màu + Size)
    expect(generateVariantProductCode('GASIA221401', 'Đỏ', '38')).toBe('GASIA221401DO38');
    expect(generateVariantProductCode('GASIA221401', 'Đỏ', '39')).toBe('GASIA221401DO39');
    expect(generateVariantProductCode('GASIA221401', 'Trắng Xanh', '41')).toBe(
      'GASIA221401TRANGXANH41'
    );
    expect(generateVariantProductCode('AKAMITO146857', 'Đỏ', 'L')).toBe('AKAMITO146857DOL');
    expect(generateVariantProductCode('AKAMITO146857', '', '')).toBe('AKAMITO146857');

    // v3.4: Chuẩn hóa mã in tem <= 200 dots (~25.0mm) để có Quiet Zone >= 4.0mm mỗi bên và khớp 2 chiều khi quét
    const longCodes = [
      'PJOGABOLA825539DENDO42',
      'PWIKA804147TRANGXANH40',
      'GUNDERARMOUR221401XADU42',
      'PASICS237486SOOVK415',
      'GASIA221401TRANGXANH41',
    ];
    for (const lc of longCodes) {
      const compact = toCompactBarcode128(lc, 200);
      const pattern = encodeCode128BPattern(lc, 200);
      expect(estimateCode128Dots(compact)).toBe(encodeCode128RawPattern(compact).length);
      expect(pattern.length).toBeLessThanOrEqual(200);
      expect(isCompactBarcodeMatchVariant(compact, lc)).toBe(true);
      expect(isScannedCodeMatchServer(compact, lc)).toBe(true);
    }

    const matchRes = matchTagToItems(
      [
        {
          productCode: 'PJOGABOLA825539',
          variantCode: 'PJOGABOLA825539DENDO41',
          productName: 'Giày Jogabola',
          color: 'Đen Đỏ',
          size: '41',
        },
        {
          productCode: 'PJOGABOLA825539',
          variantCode: 'PJOGABOLA825539DENDO42',
          productName: 'Giày Jogabola',
          color: 'Đen Đỏ',
          size: '42',
        },
      ],
      { barcode: toCompactBarcode128('PJOGABOLA825539DENDO42', 200) }
    );
    expect(matchRes.index).toBe(1);
    expect(matchRes.ambiguous).toBe(false);
  });

  it('POST /api/v1/imports/parse-file: bóc tách file CSV/Excel thành danh sách hàng có Mã gốc, Mã con (variantCode / barcode), Màu sắc, Size, Số lượng', async () => {
    const csvContent = [
      'Mã SP,Tên sản phẩm,Hãng,Màu sắc,Size,ĐVT,Số lượng,Giá gốc,Giá bán',
      'AKAMITO146857,Áo đấu Kamito Pro,Kamito,Đỏ,L,Cái,10,150000,290000',
      'AKAMITO146857,Áo đấu Kamito Pro,Kamito,Đỏ,XL,Cái,8,150000,290000',
      'AKAMITO146857,Áo đấu Kamito Pro,Kamito,Trắng,M,Cái,12,150000,290000',
    ].join('\n');

    const base64Data = Buffer.from(csvContent, 'utf-8').toString('base64');

    const parseRes = await request(app)
      .post('/api/v1/imports/parse-file')
      .set('x-user-id', 'warehouse1')
      .send({
        fileName: 'phieu-nhap-kamito.csv',
        base64Data,
      });

    expect(parseRes.status).toBe(200);
    expect(parseRes.body.data.fileType).toBe('CSV');
    expect(parseRes.body.data.items.length).toBe(3);
    expect(parseRes.body.data.items[0]).toMatchObject({
      productCode: 'AKAMITO146857',
      variantCode: 'AKAMITO146857DOL',
      barcode: 'AKAMITO146857DOL',
      productName: 'Áo đấu Kamito Pro',
      color: 'Đỏ',
      size: 'L',
      expectedQuantity: 10,
      costPrice: 150000,
      sellingPrice: 290000,
    });
    expect(parseRes.body.data.items[1]).toMatchObject({
      productCode: 'AKAMITO146857',
      variantCode: 'AKAMITO146857DOXL',
      barcode: 'AKAMITO146857DOXL',
      color: 'Đỏ',
      size: 'XL',
      expectedQuantity: 8,
    });
    expect(parseRes.body.data.items[2]).toMatchObject({
      productCode: 'AKAMITO146857',
      variantCode: 'AKAMITO146857TRANGM',
      barcode: 'AKAMITO146857TRANGM',
      color: 'Trắng',
      size: 'M',
      expectedQuantity: 12,
    });
  });

  it('Hoàn thành phiếu nhập nhiều dòng cùng mã AKAMITO146857 nhưng khác Màu/Size -> gộp thành 1 sản phẩm duy nhất với mảng variants[] có variantCode riêng cho từng thuộc tính', async () => {
    const createImp = await request(app)
      .post('/api/v1/imports')
      .set('x-user-id', 'warehouse1')
      .send({
        targetWarehouse: 'FLOOR_1',
        defaultCategoryId: aoCatId,
        note: 'Nhập lô Áo Kamito Pro 3 biến thể',
        items: [
          {
            productCode: 'AKAMITO146857',
            productName: 'Áo đấu Kamito Pro',
            brand: 'Kamito',
            color: 'Đỏ',
            size: 'L',
            unit: 'Cái',
            expectedQuantity: 10,
            actualQuantity: 9,
            costPrice: 150000,
            sellingPrice: 290000,
            isConfirmed: true,
          },
          {
            productCode: 'AKAMITO146857',
            productName: 'Áo đấu Kamito Pro',
            brand: 'Kamito',
            color: 'Đỏ',
            size: 'XL',
            unit: 'Cái',
            expectedQuantity: 8,
            actualQuantity: 8,
            costPrice: 150000,
            sellingPrice: 290000,
            isConfirmed: true,
          },
          {
            productCode: 'AKAMITO146857',
            productName: 'Áo đấu Kamito Pro',
            brand: 'Kamito',
            color: 'Trắng',
            size: 'M',
            unit: 'Cái',
            expectedQuantity: 12,
            actualQuantity: 12,
            costPrice: 150000,
            sellingPrice: 290000,
            isConfirmed: true,
          },
        ],
      });
    expect(createImp.status).toBe(201);

    // Chuyển phiếu sang trạng thái CHECKING để quét kiểm hàng thực tế
    await request(app)
      .post(`/api/v1/imports/${createImp.body.data._id}/finish-listing`)
      .set('x-user-id', 'warehouse1');

    // Quét kiểm hàng bằng Mã con AKAMITO146857DOL -> khớp chính xác dòng Đỏ - L (scannedQuantity = 1)
    const scanCheckRes = await request(app)
      .post(`/api/v1/imports/${createImp.body.data._id}/scan-check`)
      .set('x-user-id', 'warehouse1')
      .send({ barcode: 'AKAMITO146857DOL', actualQuantity: 10 });
    expect(scanCheckRes.status).toBe(200);
    expect(scanCheckRes.body.data.matched).toBe(true);
    expect(scanCheckRes.body.data.matchedIndex).toBe(0);
    expect(scanCheckRes.body.data.receipt.items[0].variantCode).toBe('AKAMITO146857DOL');
    expect(scanCheckRes.body.data.receipt.items[0].actualQuantity).toBe(10);

    // Quét kiểm hàng dòng #2 khi máy khác bật Unikey Tiếng Việt (biến DOXL -> DOÕL do Backspace)
    const scanCheckUnikeyRes = await request(app)
      .post(`/api/v1/imports/${createImp.body.data._id}/scan-check`)
      .set('x-user-id', 'warehouse1')
      .send({ barcode: 'AKAMITO146857DOÕL', actualQuantity: 8 });
    expect(scanCheckUnikeyRes.status).toBe(200);
    expect(scanCheckUnikeyRes.body.data.matched).toBe(true);
    expect(scanCheckUnikeyRes.body.data.matchedIndex).toBe(1);
    expect(scanCheckUnikeyRes.body.data.receipt.items[1].variantCode).toBe('AKAMITO146857DOXL');

    const completeRes = await request(app)
      .post(`/api/v1/imports/${createImp.body.data._id}/complete`)
      .set('x-user-id', 'warehouse1')
      .send({});
    expect(completeRes.status).toBe(200);

    const prodsRes = await request(app).get('/api/v1/products').set('x-user-id', 'admin');
    const kamitoProds = prodsRes.body.data.filter((p: any) => p.code === 'AKAMITO146857');
    expect(kamitoProds.length).toBe(1);

    const prod = kamitoProds[0];
    expect(prod.name).toBe('Áo đấu Kamito Pro');
    expect(prod.costPrice).toBe(150000);
    expect(prod.sellingPrice).toBe(290000);
    expect(prod.stockFloor1).toBe(30); // 10 + 8 + 12
    expect(prod.stockFloor2).toBe(0);
    expect(prod.stock).toBe(30);
    expect(prod.variants.length).toBe(3);

    const varDoL = prod.variants.find((v: any) => v.color === 'Đỏ' && v.size === 'L');
    const varDoXL = prod.variants.find((v: any) => v.color === 'Đỏ' && v.size === 'XL');
    const varTrangM = prod.variants.find((v: any) => v.color === 'Trắng' && v.size === 'M');
    expect(varDoL.variantCode).toBe('AKAMITO146857DOL');
    expect(varDoL.barcode).toBe('AKAMITO146857DOL');
    expect(varDoXL.variantCode).toBe('AKAMITO146857DOXL');
    expect(varTrangM.variantCode).toBe('AKAMITO146857TRANGM');
  });

  it('Bán hàng POS chọn đúng Màu + Size, chuyển tầng theo Màu + Size và cập nhật biến thể từ CMS', async () => {
    const prodsRes = await request(app).get('/api/v1/products').set('x-user-id', 'admin');
    const prod = prodsRes.body.data.find((p: any) => p.code === 'AKAMITO146857');

    // 1. Bán 3 áo Đỏ - L trên POS
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('x-user-id', 'sales1')
      .send({
        customerName: 'Trần Văn Thể Thao',
        customerPhone: '0933444555',
        paymentMethod: 'CASH',
        items: [
          {
            productId: prod._id,
            color: 'Đỏ',
            size: 'L',
            quantity: 3,
          },
        ],
      });
    expect(orderRes.status).toBe(201);
    expect(orderRes.body.data.items[0].color).toBe('Đỏ');
    expect(orderRes.body.data.items[0].size).toBe('L');

    // Kiểm tra tồn của Đỏ - L giảm từ 10 -> 7, tổng tồn giảm từ 30 -> 27
    const afterSaleRes = await request(app).get('/api/v1/products').set('x-user-id', 'admin');
    const prodAfterSale = afterSaleRes.body.data.find((p: any) => p._id === prod._id);
    expect(prodAfterSale.stock).toBe(27);
    const redL = prodAfterSale.variants.find((v: any) => v.color === 'Đỏ' && v.size === 'L');
    expect(redL.stockFloor1).toBe(7);

    // 2. Chặn bán vượt tồn của biến thể Đỏ - XL (chỉ có 8 cái ở Tầng 1, bán 9 -> chặn 400 INSUFFICIENT_STOCK)
    const overVariantSale = await request(app)
      .post('/api/v1/orders')
      .set('x-user-id', 'sales1')
      .send({
        customerName: 'Khách Mua Quá Size XL',
        customerPhone: '0933444666',
        paymentMethod: 'CASH',
        items: [
          {
            productId: prod._id,
            color: 'Đỏ',
            size: 'XL',
            quantity: 9,
          },
        ],
      });
    expect(overVariantSale.status).toBe(400);
    expect(overVariantSale.body.code).toBe('INSUFFICIENT_STOCK');

    // 3. Chuyển 2 cái Trắng - M từ Kho Tầng 1 xuống Kho Tầng 2
    const transferRes = await request(app)
      .post('/api/v1/inventory/transfers')
      .set('x-user-id', 'admin')
      .send({
        productId: prod._id,
        color: 'Trắng',
        size: 'M',
        fromWarehouse: 'FLOOR_1',
        toWarehouse: 'FLOOR_2',
        quantity: 2,
      });
    expect(transferRes.status).toBe(201);
    const whiteM = transferRes.body.data.product.variants.find(
      (v: any) => v.color === 'Trắng' && v.size === 'M'
    );
    expect(whiteM.stockFloor1).toBe(10);
    expect(whiteM.stockFloor2).toBe(2);
    expect(whiteM.stock).toBe(12);

    // 4. Admin thêm 1 biến thể mới (Vàng - S, số lượng 5) từ CMS
    const addVariantRes = await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'admin')
      .send({
        code: 'AKAMITO146857',
        name: 'Áo đấu Kamito Pro',
        categoryId: aoCatId,
        color: 'Vàng',
        size: 'S',
        quantity: 5,
        targetWarehouse: 'FLOOR_1',
        upsertIfExists: true,
      });
    expect(addVariantRes.status).toBe(200);
    expect(addVariantRes.body.data.variants.length).toBe(4);
    expect(addVariantRes.body.data.stock).toBe(32); // 27 + 5
    const yellowS = addVariantRes.body.data.variants.find(
      (v: any) => v.color === 'Vàng' && v.size === 'S'
    );
    expect(yellowS.variantCode).toBe('AKAMITO146857VANGS');
  });
});
