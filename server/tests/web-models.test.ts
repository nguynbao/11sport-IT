import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  connectDatabase,
  clearDatabase,
  disconnectDatabase,
  categoryRepo,
  brandRepo,
  productRepo,
  orderRepo,
  customerRepo,
  promotionRepo,
} from '../src/config/db';
import { ProductModel } from '../src/models/Product';
import { CategoryModel } from '../src/models/Category';
import { BrandModel } from '../src/models/Brand';
import { OrderModel } from '../src/models/Order';
import { CustomerModel } from '../src/models/Customer';
import { PromotionModel } from '../src/models/Promotion';
import { WebBannerModel } from '../src/models/WebBanner';
import { WebHomeSectionModel } from '../src/models/WebHomeSection';
import { WebMenuModel } from '../src/models/WebMenu';
import { WebArticleCategoryModel } from '../src/models/WebArticleCategory';
import { WebArticleModel } from '../src/models/WebArticle';
import { WebStaticPageModel } from '../src/models/WebStaticPage';
import { WebReviewModel } from '../src/models/WebReview';
import { WebRedirectModel } from '../src/models/WebRedirect';
import { WebSiteSettingModel } from '../src/models/WebSiteSetting';
import { WebAuditLogModel } from '../src/models/WebAuditLog';
import { CustomerOtpModel } from '../src/models/CustomerOtp';

describe('WEB-05: Storefront & CMS Web Models (Backward Compatibility & New Schemas)', () => {
  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('Giữ tương thích ngược 100% cho POS/CMS trên 6 model hiện có và gán default an toàn', async () => {
    const catDoc = new CategoryModel({ code: 'VOT', name: 'Vợt Pickleball', status: 'ACTIVE' });
    expect(catDoc.validateSync()).toBeUndefined();
    expect(catDoc.isPublishedOnline).toBe(false);
    expect(catDoc.sortOrder).toBe(0);

    const cat = await categoryRepo.create({ code: 'VOT', name: 'Vợt Pickleball', status: 'ACTIVE' });
    expect(cat._id).toBeTruthy();

    const brandDoc = new BrandModel({
      code: 'JLA',
      name: 'Joola',
      status: 'ACTIVE',
      categoryIds: [String(cat._id)],
    });
    expect(brandDoc.validateSync()).toBeUndefined();
    expect(brandDoc.isPublishedOnline).toBe(false);

    const brand = await brandRepo.create({
      code: 'JLA',
      name: 'Joola',
      status: 'ACTIVE',
      categoryIds: [String(cat._id)],
    });
    expect(brand.code).toBe('JLA');

    const prodDoc = new ProductModel({
      code: 'VOTJLA01',
      name: 'Joola Perseus 16mm',
      categoryId: String(cat._id),
      sellingPrice: 4290000,
      stock: 5,
    });
    expect(prodDoc.validateSync()).toBeUndefined();
    expect(prodDoc.isPublishedOnline).toBe(false);
    expect(prodDoc.isFeatured).toBe(false);

    const prod = await productRepo.create({
      code: 'VOTJLA01',
      name: 'Joola Perseus 16mm',
      categoryId: String(cat._id),
      sellingPrice: 4290000,
      stock: 5,
    });
    expect(prod.code).toBe('VOTJLA01');

    const orderDoc = new OrderModel({
      orderCode: 'HD-POS-001',
      subtotal: 4290000,
      paymentMethod: 'CASH',
      totalAmount: 4290000,
    });
    expect(orderDoc.validateSync()).toBeUndefined();
    expect(orderDoc.channel).toBe('POS');

    const order = await orderRepo.create({
      orderCode: 'HD-POS-001',
      subtotal: 4290000,
      paymentMethod: 'CASH',
      totalAmount: 4290000,
    });
    expect(order.orderCode).toBe('HD-POS-001');

    const custDoc = new CustomerModel({ phone: '0901111222', name: 'Khách POS' });
    const custEmailDoc = new CustomerModel({ email: 'guest@11sport.vn', name: 'Khách Email OTP' });
    expect(custDoc.validateSync()).toBeUndefined();
    expect(custEmailDoc.validateSync()).toBeUndefined();
    expect(custDoc.isVerified).toBe(false);

    const cust = await customerRepo.create({ phone: '0901111222', name: 'Khách POS' });
    expect(cust.phone).toBe('0901111222');

    const promoDoc = new PromotionModel({ code: 'POSKM01', name: 'Khuyến mãi POS' });
    expect(promoDoc.validateSync()).toBeUndefined();
    expect(promoDoc.applyChannels).toEqual(['POS']);
    expect(promoDoc.isFlashSale).toBe(false);

    const promo = await promotionRepo.create({ code: 'POSKM01', name: 'Khuyến mãi POS' });
    expect(promo.code).toBe('POSKM01');
  });

  it('Validate đầy đủ 11 Web Model mới và kiểm tra cấu hình index', () => {
    const banner = new WebBannerModel({
      title: 'Hero Sale',
      position: 'HERO',
      desktopImageUrl: 'https://cdn.11sport.vn/hero-desktop.jpg',
      mobileImageUrl: 'https://cdn.11sport.vn/hero-mobile.jpg',
      status: 'ACTIVE',
      sortOrder: 1,
    });
    expect(banner.validateSync()).toBeUndefined();

    const section = new WebHomeSectionModel({
      type: 'CATEGORY_GRID',
      title: 'Vợt Pickleball',
      isActive: true,
      sortOrder: 1,
    });
    expect(section.validateSync()).toBeUndefined();

    const menu = new WebMenuModel({
      label: 'Vợt Pickleball',
      url: '/danh-muc/vot-pickleball',
      sortOrder: 1,
    });
    expect(menu.validateSync()).toBeUndefined();
    expect(menu.isActive).toBe(true);

    const artCat = new WebArticleCategoryModel({
      name: 'Hướng dẫn chọn vợt',
      slug: 'huong-dan-chon-vot',
    });
    expect(artCat.validateSync()).toBeUndefined();

    const article = new WebArticleModel({
      title: 'Cách chọn vợt Pickleball cho người mới',
      slug: 'cach-chon-vot-pickleball',
      categoryId: String(artCat._id),
      status: 'PUBLISHED',
      publishedAt: new Date(),
    });
    expect(article.validateSync()).toBeUndefined();

    const page = new WebStaticPageModel({
      title: 'Chính sách đổi trả',
      slug: 'chinh-sach-doi-tra',
      contentHtml: '<p>Đổi trả trong 7 ngày</p>',
      status: 'PUBLISHED',
    });
    expect(page.validateSync()).toBeUndefined();

    const review = new WebReviewModel({
      productId: 'prod-1',
      customerName: 'Minh Anh',
      rating: 5,
      comment: 'Vợt đánh rất đầm tay',
      isVerifiedPurchase: true,
    });
    expect(review.validateSync()).toBeUndefined();
    expect(review.status).toBe('PENDING');

    const redirect = new WebRedirectModel({
      fromPath: '/sp-cu',
      toPath: '/san-pham/sp-moi',
      statusCode: 301,
    });
    expect(redirect.validateSync()).toBeUndefined();

    const setting = new WebSiteSettingModel({
      key: 'DEFAULT',
      siteName: '11 Sport',
      onlineStockMode: 'FLOOR_1',
    });
    expect(setting.validateSync()).toBeUndefined();
    expect(setting.freeShipThreshold).toBe(500000);

    const audit = new WebAuditLogModel({
      actorId: 'staff-1',
      actorName: 'Admin',
      actorRole: 'ADMIN',
      action: 'PUBLISH',
      entityType: 'WebArticle',
      entityId: String(article._id),
    });
    expect(audit.validateSync()).toBeUndefined();

    const otp = new CustomerOtpModel({
      identifier: 'guest@11sport.vn',
      channel: 'EMAIL',
      otpHash: 'hashed-otp',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });
    expect(otp.validateSync()).toBeUndefined();
    expect(otp.attempts).toBe(0);

    // Kiểm tra các unique sparse index quan trọng
    const prodIndexes = ProductModel.schema.indexes();
    expect(
      prodIndexes.some(([fields, opts]) => fields.slug === 1 && opts.unique && opts.sparse)
    ).toBe(true);

    const custIndexes = CustomerModel.schema.indexes();
    expect(
      custIndexes.some(([fields, opts]) => fields.email === 1 && opts.unique && opts.sparse)
    ).toBe(true);

    const promoIndexes = PromotionModel.schema.indexes();
    expect(
      promoIndexes.some(([fields, opts]) => fields.couponCode === 1 && opts.unique && opts.sparse)
    ).toBe(true);

    const redirectIndexes = WebRedirectModel.schema.indexes();
    expect(
      redirectIndexes.some(([fields, opts]) => fields.fromPath === 1 && opts.unique)
    ).toBe(true);
  });
});
