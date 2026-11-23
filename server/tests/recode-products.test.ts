import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db, ObjectId } from 'mongodb';
import {
  applyRecode,
  assertLocalMongoUri,
  buildRecodePlan,
  readReviewFile,
  writeReviewCsv,
  ReviewRow,
} from '../src/scripts/recodeProducts';
import { toCompactBarcode128 } from '../src/utils/productCode';
import { createApp } from '../src/app';

/**
 * AC5 — Chuyển đổi dữ liệu cũ (dry-run -> file review -> apply) chạy trên MongoDB in-memory (mongodb-memory-server).
 */
describe('AC5: recodeProducts dry-run / apply trên DB tạm', () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;
  let tmpDir: string;
  const ids = {
    catGiay: new ObjectId(),
    catAo: new ObjectId(),
    catPk: new ObjectId(),
    catBong: new ObjectId(),
    p1: new ObjectId(),
    p2a: new ObjectId(),
    p2b: new ObjectId(),
    p3: new ObjectId(),
    p4: new ObjectId(),
    p5: new ObjectId(),
  };
  let rows: ReviewRow[] = [];

  const t = (n: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, n));

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create({ binary: { version: '7.0.24' } });
    client = new MongoClient(mongod.getUri());
    await client.connect();
    db = client.db('recode_test');
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recode-'));

    await db.collection('categories').insertMany([
      { _id: ids.catGiay, code: 'GIAY', name: 'Giày', status: 'ACTIVE', createdAt: t(1) },
      { _id: ids.catAo, code: 'AO_QUAN_VAY_PHUKIEN', name: 'Thời trang', status: 'ACTIVE', createdAt: t(2) },
      { _id: ids.catPk, code: 'PHU_KIEN', name: 'Phụ kiện', status: 'ACTIVE', createdAt: t(3) },
      { _id: ids.catBong, code: 'BONG_THI_DAU', name: 'Bóng thi đấu', status: 'ACTIVE', createdAt: t(4) },
    ]);
    const v = (color: string, size: string, code: string, f1: number, f2: number) => ({
      variantKey: 'X',
      color,
      size,
      variantCode: code,
      barcode: code,
      colorHexes: [],
      stockFloor1: f1,
      stockFloor2: f2,
      stock: f1 + f2,
    });
    await db.collection('products').insertMany([
      {
        _id: ids.p1,
        code: 'GASICS497140',
        barcode: 'GASICS497140',
        name: 'Asics SOLUTION SPEED FF4',
        brand: 'Asics',
        categoryId: String(ids.catGiay),
        categoryCode: 'GIAY',
        unit: 'Đôi',
        sellingPrice: 2000000,
        costPrice: 1200000,
        variants: [v('Cherry Tomato', '42', 'GASICS497140CHTOMA42', 2, 1), v('Cherry Tomato', '40,5', 'GASICS497140CHTOM405', 1, 0)],
        stockFloor1: 3,
        stockFloor2: 1,
        stock: 4,
        status: 'ACTIVE',
        createdAt: t(10),
      },
      {
        _id: ids.p2a,
        code: 'AKAMITO262650',
        barcode: 'AKAMITO262650',
        name: 'Áo Tshirt Thể thao Unisex V1',
        brand: 'Kamito',
        categoryId: String(ids.catAo),
        unit: 'Chiếc',
        sellingPrice: 250000,
        costPrice: 120000,
        variants: [v('Trắng', 'L', 'AKAMITO262650TRANGL', 3, 0)],
        stockFloor1: 3,
        stockFloor2: 0,
        stock: 3,
        status: 'ACTIVE',
        createdAt: t(11),
      },
      {
        _id: ids.p2b,
        code: 'AKAMITO262640',
        barcode: 'AKAMITO262640',
        name: 'Áo Tshirt Thể thao Unisex V1',
        brand: 'Kamito',
        categoryId: String(ids.catAo),
        unit: 'Chiếc',
        sellingPrice: 260000,
        costPrice: 130000,
        variants: [v('Đen', 'L', 'AKAMITO262640DENL', 2, 1), v('Trắng', 'L', 'AKAMITO262640TRANGL', 1, 0)],
        stockFloor1: 3,
        stockFloor2: 1,
        stock: 4,
        status: 'ACTIVE',
        createdAt: t(12),
      },
      {
        _id: ids.p3,
        code: 'PNN268886',
        barcode: 'PNN268886',
        name: 'Mũ thể thao',
        brand: '',
        categoryId: String(ids.catPk),
        unit: 'Cái',
        sellingPrice: 90000,
        costPrice: 40000,
        variants: [],
        stockFloor1: 4,
        stockFloor2: 2,
        stock: 6,
        status: 'ACTIVE',
        createdAt: t(13),
      },
      {
        _id: ids.p4,
        code: 'BFACOLOS393344',
        barcode: 'BFACOLOS393344',
        name: 'Facolos F Eco',
        brand: 'Facolos',
        categoryId: String(ids.catBong),
        unit: 'Quả',
        sellingPrice: 30000,
        costPrice: 15000,
        variants: [],
        stockFloor1: 10,
        stockFloor2: 0,
        stock: 10,
        parentSetProductId: String(ids.p5),
        packSize: 3,
        status: 'ACTIVE',
        createdAt: t(14),
      },
      {
        _id: ids.p5,
        code: 'BFACOLOS192650',
        barcode: 'BFACOLOS192650',
        name: 'Facolos F Eco',
        brand: 'Facolos',
        categoryId: String(ids.catBong),
        unit: 'Hộp',
        sellingPrice: 85000,
        costPrice: 40000,
        variants: [],
        stockFloor1: 2,
        stockFloor2: 5,
        stock: 7,
        status: 'ACTIVE',
        createdAt: t(15),
      },
    ]);
    await db.collection('orders').insertOne({
      orderCode: 'HD-0001',
      items: [
        { productId: String(ids.p2b), productCode: 'AKAMITO262640', productName: 'Áo', color: 'Đen', size: 'L', quantity: 1 },
        { productId: String(ids.p1), productCode: 'GASICS497140', productName: 'Giày', color: 'Cherry Tomato', size: '42', quantity: 1 },
        { productId: 'deleted-id', productCode: 'XDELETED123456', productName: 'SP đã xoá', quantity: 1 },
      ],
    });
    await db.collection('stockmovements').insertMany([
      { productId: String(ids.p1), productCode: 'GASICS497140', quantityChange: 4 },
      { productId: String(ids.p2b), productCode: 'AKAMITO262640', quantityChange: 4 },
      { productId: String(ids.p3), productCode: 'PNN268886', quantityChange: 6 },
    ]);
    await db.collection('importreceipts').insertOne({
      code: 'PN-0001',
      items: [
        {
          productId: String(ids.p1),
          productCode: 'GASICS497140',
          variantCode: 'GASICS497140CHTOMA42',
          barcode: 'GASICS497140CHTOMA42',
          color: 'Cherry Tomato',
          size: '42',
        },
        { productId: '', productCode: 'AKAMITO262640', variantCode: 'AKAMITO262640DENL', barcode: 'AKAMITO262640DENL', color: 'Đen', size: 'L' },
      ],
    });
    await db.collection('returnexchanges').insertOne({
      code: 'DT-0001',
      returnItems: [{ productId: String(ids.p3), productCode: 'PNN268886', quantity: 1 }],
      exchangeItems: [{ productId: String(ids.p2b), productCode: 'AKAMITO262640', color: 'Đen', size: 'L', quantity: 1 }],
    });
    await db.collection('promotions').insertOne({
      code: 'KM1',
      conditionProductIds: [String(ids.p2a), String(ids.p2b)],
      conditionProducts: [
        { productId: String(ids.p2a), productCode: 'AKAMITO262650' },
        { productId: String(ids.p2b), productCode: 'AKAMITO262640' },
      ],
      giftItems: [{ productId: String(ids.p3), productCode: 'PNN268886', quantity: 1 }],
    });
    await db.collection('shifthandovers').insertOne({
      date: '2026-11-17',
      discrepancies: [{ productCode: 'GASICS497140CHTOMA42', expected: 3, actual: 2 }],
    });
  }, 120000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    await client?.close();
    await mongod?.stop();
  });

  it('Guard: từ chối MONGODB_URI không phải local hoặc mongodb+srv', () => {
    expect(() => assertLocalMongoUri(undefined)).toThrow();
    expect(() => assertLocalMongoUri('mongodb+srv://u:p@cluster0.mongodb.net/db')).toThrow(/mongodb\+srv/);
    expect(() => assertLocalMongoUri('mongodb://10.0.0.5:27017/11sport')).toThrow();
    expect(() => assertLocalMongoUri('mongodb://127.0.0.1.evil.com:27017/x')).toThrow();
    expect(() => assertLocalMongoUri('mongodb://127.0.0.1:27017,db.prod.com:27017/x')).toThrow();
    expect(assertLocalMongoUri('mongodb://127.0.0.1:27017/11sportDB')).toBe('mongodb://127.0.0.1:27017/11sportDB');
    expect(assertLocalMongoUri('mongodb://localhost/11sport')).toBeTruthy();
  });

  it('Dry-run: tách Brand/Version, đề xuất mã, đánh dấu gộp/xung đột/NN; không ghi DB', async () => {
    const before = await db.collection('products').find({}).toArray();
    const plan = await buildRecodePlan(db);
    rows = plan.rows;
    const after = await db.collection('products').find({}).toArray();
    expect(after).toEqual(before);
    expect(await db.listCollections({ name: 'brands' }).toArray()).toHaveLength(0);

    expect(plan.stats.products).toBe(6);
    expect(plan.stats.mergeGroups).toBe(1);
    expect(plan.stats.mergedAway).toBe(1);
    expect(plan.stats.noBrand).toBe(1);
    expect(plan.stats.conflicts).toBeGreaterThanOrEqual(1); // Facolos Quả / Hộp khác ĐVT

    const p1 = rows.find((r) => r.productId === String(ids.p1) && r.size === '42')!;
    expect(p1.newCode).toBe('GASCSSFF4');
    expect(p1.brandCode).toBe('ASC');
    expect(p1.versionName).toBe('SOLUTION SPEED FF4');
    expect(p1.newVariantCode).toBe('GASCSSFF4CT42');
    const merged = rows.find((r) => r.productId === String(ids.p2b))!;
    expect(merged.status).toBe('MERGE');
    expect(merged.mergeIntoCode).toBe('AKAMITO262650');
    const nn = rows.find((r) => r.productId === String(ids.p3))!;
    expect(nn.brandCode).toBe('NN');
    expect(nn.status).toBe('NN');
    const box = rows.find((r) => r.productId === String(ids.p5))!;
    const ball = rows.find((r) => r.productId === String(ids.p4))!;
    expect(box.status).toBe('CONFLICT');
    expect(box.newCode).not.toBe(ball.newCode);

    // File review CSV (UTF-8 BOM) đọc lại được, kể cả khi Excel lưu bằng dấu chấm phẩy
    const file = path.join(tmpDir, 'review.csv');
    writeReviewCsv(rows, file);
    expect(fs.readFileSync(file, 'utf8').charCodeAt(0)).toBe(0xfeff);
    const back = readReviewFile(file);
    expect(back).toEqual(rows);
    const semi = path.join(tmpDir, 'review-semicolon.csv');
    const text = fs.readFileSync(file, 'utf8').replace(/,/g, ';');
    fs.writeFileSync(semi, text, 'utf8');
    expect(readReviewFile(semi).length).toBe(rows.length);
  });

  it('Apply: file lỗi => từ chối, không ghi DB', async () => {
    const bad = rows.map((r) => (r.productId === String(ids.p3) ? { ...r, brandCode: 'TOOLONG' } : r));
    await expect(applyRecode(db, bad, { backupDir: tmpDir, useMongodump: false })).rejects.toThrow(/brandCode/);
    const bad2 = rows.map((r) => (r.productId === String(ids.p5) ? { ...r, versionCode: ball().versionCode } : r));
    await expect(applyRecode(db, bad2, { backupDir: tmpDir, useMongodump: false })).rejects.toThrow(/ĐVT/);
    const p1 = await db.collection('products').findOne({ _id: ids.p1 });
    expect(p1!.code).toBe('GASICS497140');
    function ball() {
      return rows.find((r) => r.productId === String(ids.p4))!;
    }
  });

  it('Apply: backup, đổi mã tại chỗ, gộp, cập nhật tham chiếu, tồn T1/T2 không đổi, không còn mã cũ', async () => {
    // Chủ dự án sửa VersionCode của Mũ thể thao trong file
    const reviewed = rows.map((r) => (r.productId === String(ids.p3) ? { ...r, versionCode: 'MUTT', versionName: 'Mũ thể thao' } : r));
    const report = await applyRecode(db, reviewed, { backupDir: tmpDir, useMongodump: false, client });

    expect(fs.existsSync(path.join(report.backupPath, 'products.ejson'))).toBe(true);
    expect(fs.existsSync(path.join(report.backupPath, 'recode-report.json'))).toBe(true);
    expect(report.stockMatched).toBe(true);
    expect(report.stockBefore).toEqual({ floor1: 25, floor2: 9 });
    expect(report.productsBefore).toBe(6);
    expect(report.productsAfter).toBe(5);
    expect(report.remainingLegacyRefs).toBe(0);
    expect(report.orphanRefs).toBe(1); // đơn tham chiếu sản phẩm đã xoá từ trước

    const p1 = await db.collection('products').findOne({ _id: ids.p1 });
    expect(p1!.code).toBe('GASCSSFF4');
    expect(p1!.barcode).toBe('GASCSSFF4');
    expect(p1!.legacyCode).toBe('GASICS497140');
    expect(p1!.versionCode).toBe('SSFF4');
    expect(p1!.brandCode).toBe('ASC');
    const v42 = p1!.variants.find((x: any) => x.size === '42');
    expect(v42.variantCode).toBe('GASCSSFF4CT42');
    expect(v42.colorCode).toBe('CT');
    expect(v42.legacyVariantCode).toBe('GASICS497140CHTOMA42');

    // Gộp: giữ _id sản phẩm cũ nhất, cộng tồn theo biến thể, giữ giá khác nhau ở cấp biến thể
    expect(await db.collection('products').findOne({ _id: ids.p2b })).toBeNull();
    const p2 = await db.collection('products').findOne({ _id: ids.p2a });
    expect(p2!.code).toMatch(/^TKMT/);
    expect(p2!.legacyCodes).toEqual(['AKAMITO262650', 'AKAMITO262640']);
    expect(p2!.stockFloor1).toBe(6);
    expect(p2!.stockFloor2).toBe(1);
    const trang = p2!.variants.find((x: any) => x.color === 'Trắng');
    expect(trang.stockFloor1).toBe(4);
    expect(trang.legacyVariantCodes).toEqual(['AKAMITO262650TRANGL', 'AKAMITO262640TRANGL']);
    const den = p2!.variants.find((x: any) => x.color === 'Đen');
    expect(den.sellingPrice).toBe(260000);
    expect(den.costPrice).toBe(130000);

    const p3 = await db.collection('products').findOne({ _id: ids.p3 });
    expect(p3!.code).toBe('PNNMUTT');
    const p4 = await db.collection('products').findOne({ _id: ids.p4 });
    expect(p4!.parentSetProductId).toBe(String(ids.p5));

    const brands = await db.collection('brands').find({}).toArray();
    expect(brands.map((b) => b.code)).toEqual(expect.arrayContaining(['NN', 'ASC', 'KMT', 'FCL']));
    const cat = await db.collection('categories').findOne({ _id: ids.catGiay });
    expect(cat!.skuCode).toBe('G');

    // Bảng tham chiếu
    const order = await db.collection('orders').findOne({ orderCode: 'HD-0001' });
    expect(order!.items[0].productId).toBe(String(ids.p2a));
    expect(order!.items[0].productCode).toBe(p2!.code);
    expect(order!.items[0].legacyCode).toBe('AKAMITO262640');
    expect(order!.items[1].productCode).toBe('GASCSSFF4');
    const mv = await db.collection('stockmovements').findOne({ legacyCode: 'AKAMITO262640' });
    expect(mv!.productId).toBe(String(ids.p2a));
    const rc = await db.collection('importreceipts').findOne({ code: 'PN-0001' });
    expect(rc!.items[0].variantCode).toBe('GASCSSFF4CT42');
    expect(rc!.items[0].barcode).toBe('GASCSSFF4CT42');
    expect(rc!.items[0].legacyVariantCode).toBe('GASICS497140CHTOMA42');
    expect(rc!.items[1].variantCode).toBe(den.variantCode);
    const ret = await db.collection('returnexchanges').findOne({ code: 'DT-0001' });
    expect(ret!.returnItems[0].productCode).toBe('PNNMUTT');
    expect(ret!.exchangeItems[0].productId).toBe(String(ids.p2a));
    const promo = await db.collection('promotions').findOne({ code: 'KM1' });
    expect(promo!.conditionProductIds).toEqual([String(ids.p2a)]);
    expect(promo!.giftItems[0].productCode).toBe('PNNMUTT');
    const sh = await db.collection('shifthandovers').findOne({ date: '2026-11-17' });
    expect(sh!.discrepancies[0].productCode).toBe('GASCSSFF4CT42');
    expect(sh!.discrepancies[0].legacyCode).toBe('GASICS497140CHTOMA42');

    // Chạy lại dry-run: tất cả đã chuyển đổi
    const again = await buildRecodePlan(db);
    expect(again.stats.alreadyRecoded).toBe(5);
  }, 60000);

  it('Quét tem cũ (mã cũ / mã con cũ / mã rút gọn Code128 cũ) vẫn tìm ra sản phẩm', async () => {
    await mongoose.connect(`${mongod.getUri()}recode_test`);
    const app = createApp();
    const oldVariant = await request(app).get('/api/v1/products/lookup?code=GASICS497140CHTOMA42');
    expect(oldVariant.status).toBe(200);
    expect(oldVariant.body.data.matchedBy).toBe('LEGACY_VARIANT_CODE');
    expect(oldVariant.body.data.variant.variantCode).toBe('GASCSSFF4CT42');
    const oldRoot = await request(app).get('/api/v1/products/lookup?code=AKAMITO262640');
    expect(oldRoot.body.data.matchedBy).toBe('LEGACY_CODE');
    expect(oldRoot.body.data.product._id).toBe(String(ids.p2a));
    const compact = toCompactBarcode128('GASICS497140CHTOM405', 200);
    const compactRes = await request(app).get(`/api/v1/products/lookup?code=${compact}`);
    expect(compactRes.status).toBe(200);
    expect(compactRes.body.data.product.code).toBe('GASCSSFF4');
    const search = await request(app).get('/api/v1/products?search=GASICS497140');
    expect(search.body.data[0].code).toBe('GASCSSFF4');
  }, 60000);
});
