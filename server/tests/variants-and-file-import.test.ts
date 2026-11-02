import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase, disconnectDatabase } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';
import { generateProductCode } from '../src/utils/productCode';

const app = createApp();

describe('v2.8: Quy 1 loại SP = 1 Mã IN HOA VIẾT LIỀN, Quản lý biến thể (Màu + Size) & Import PDF/Excel', () => {
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

  it('Sinh mã chung IN HOA VIẾT LIỀN không chứa màu/size (VD: AOKAMITOPRO, GIAYASICSCOURTFF3)', () => {
    expect(
      generateProductCode({
        categoryCode: 'AO',
        brand: 'Kamito',
        modelName: 'Pro',
      })
    ).toBe('AOKAMITOPRO');

    expect(
      generateProductCode({
        categoryCode: 'GIAY',
        brand: 'Asics',
        modelName: 'Court FF3',
      })
    ).toBe('GIAYASICSCOURTFF3');

    // Tự động bóc tách màu + size ở cuối chuỗi trong ngoặc và không đưa vào mã
    expect(generateProductCode('Áo Kamito Pro (Áo Kamito Pro Đỏ size L)')).toBe('AOKAMITOPRO');
    expect(generateProductCode('Áo Kamito Pro (Áo Kamito Pro Xanh Đen size XL)')).toBe(
      'AOKAMITOPRO'
    );
  });

  it('POST /api/v1/imports/parse-file: bóc tách file CSV/Excel thành danh sách hàng có Mã SP, Màu sắc, Size, Số lượng, Giá gốc, Giá bán', async () => {
    const csvContent = [
      'Mã SP,Tên sản phẩm,Hãng,Màu sắc,Size,ĐVT,Số lượng,Giá gốc,Giá bán',
      'AOKAMITOPRO,Áo đấu Kamito Pro,Kamito,Đỏ,L,Cái,10,150000,290000',
      'AOKAMITOPRO,Áo đấu Kamito Pro,Kamito,Đỏ,XL,Cái,8,150000,290000',
      'AOKAMITOPRO,Áo đấu Kamito Pro,Kamito,Trắng,M,Cái,12,150000,290000',
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
      productCode: 'AOKAMITOPRO',
      productName: 'Áo đấu Kamito Pro',
      color: 'Đỏ',
      size: 'L',
      expectedQuantity: 10,
      costPrice: 150000,
      sellingPrice: 290000,
    });
    expect(parseRes.body.data.items[2]).toMatchObject({
      productCode: 'AOKAMITOPRO',
      color: 'Trắng',
      size: 'M',
      expectedQuantity: 12,
    });
  });

  it('Hoàn thành phiếu nhập nhiều dòng cùng mã AOKAMITOPRO nhưng khác Màu/Size -> gộp thành 1 sản phẩm duy nhất với mảng variants[]', async () => {
    const createImp = await request(app)
      .post('/api/v1/imports')
      .set('x-user-id', 'warehouse1')
      .send({
        targetWarehouse: 'FLOOR_1',
        defaultCategoryId: aoCatId,
        note: 'Nhập lô Áo Kamito Pro 3 biến thể',
        items: [
          {
            productCode: 'AOKAMITOPRO',
            productName: 'Áo đấu Kamito Pro',
            brand: 'Kamito',
            color: 'Đỏ',
            size: 'L',
            unit: 'Cái',
            expectedQuantity: 10,
            actualQuantity: 10,
            costPrice: 150000,
            sellingPrice: 290000,
            isConfirmed: true,
          },
          {
            productCode: 'AOKAMITOPRO',
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
            productCode: 'AOKAMITOPRO',
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

    const completeRes = await request(app)
      .post(`/api/v1/imports/${createImp.body.data._id}/complete`)
      .set('x-user-id', 'warehouse1')
      .send({});
    expect(completeRes.status).toBe(200);

    const prodsRes = await request(app).get('/api/v1/products').set('x-user-id', 'admin');
    const kamitoProds = prodsRes.body.data.filter((p: any) => p.code === 'AOKAMITOPRO');
    expect(kamitoProds.length).toBe(1);

    const prod = kamitoProds[0];
    expect(prod.name).toBe('Áo đấu Kamito Pro');
    expect(prod.costPrice).toBe(150000);
    expect(prod.sellingPrice).toBe(290000);
    expect(prod.stockFloor1).toBe(30); // 10 + 8 + 12
    expect(prod.stockFloor2).toBe(0);
    expect(prod.stock).toBe(30);
    expect(prod.variants.length).toBe(3);
  });

  it('Bán hàng POS chọn đúng Màu + Size, chuyển tầng theo Màu + Size và cập nhật biến thể từ CMS', async () => {
    const prodsRes = await request(app).get('/api/v1/products').set('x-user-id', 'admin');
    const prod = prodsRes.body.data.find((p: any) => p.code === 'AOKAMITOPRO');

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
        code: 'AOKAMITOPRO',
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
  });
});
