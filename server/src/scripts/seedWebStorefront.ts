import dotenv from 'dotenv';
dotenv.config();

import { connectDatabase, disconnectDatabase } from '../config/db';
import { CategoryModel } from '../models/Category';
import { BrandModel } from '../models/Brand';
import { ProductModel } from '../models/Product';
import { WebBannerModel } from '../models/WebBanner';
import { WebHomeSectionModel } from '../models/WebHomeSection';
import { WebArticleCategoryModel } from '../models/WebArticleCategory';
import { WebArticleModel } from '../models/WebArticle';
import { WebStaticPageModel } from '../models/WebStaticPage';
import { WebSiteSettingModel } from '../models/WebSiteSetting';
import { PromotionModel } from '../models/Promotion';

function slugifyVi(input: string): string {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

const STOREFRONT_CATEGORIES = [
  { code: 'WEB-VOT-PB', name: 'Vợt Pickleball', slug: 'vot-pickleball', sortOrder: 1 },
  { code: 'WEB-VOT-T700', name: 'Vợt Carbon T700', slug: 'vot-carbon-t700', sortOrder: 2 },
  { code: 'WEB-VOT-NEW', name: 'Vợt cho người mới', slug: 'vot-nguoi-moi', sortOrder: 3 },
  { code: 'WEB-VOT-PRO', name: 'Vợt thi đấu chuyên nghiệp', slug: 'vot-chuyen-nghiep', sortOrder: 4 },
  { code: 'WEB-BONG-PB', name: 'Bóng Pickleball thi đấu', slug: 'bong-pickleball', sortOrder: 5 },
  { code: 'WEB-GIAY', name: 'Giày thể thao', slug: 'giay-the-thao', sortOrder: 6 },
  { code: 'WEB-GIAY-PB', name: 'Giày Pickleball & Tennis', slug: 'giay-pickleball', sortOrder: 7 },
  { code: 'WEB-GIAY-CL', name: 'Giày Cầu lông', slug: 'giay-cau-long', sortOrder: 8 },
  { code: 'WEB-VO', name: 'Vớ thể thao chuyên dụng', slug: 'vo-the-thao', sortOrder: 9 },
  { code: 'WEB-TT', name: 'Thời trang thể thao', slug: 'thoi-trang', sortOrder: 10 },
  { code: 'WEB-TT-NAM', name: 'Áo thể thao nam', slug: 'ao-nam', sortOrder: 11 },
  { code: 'WEB-TT-NU', name: 'Áo & Váy thể thao nữ', slug: 'thoi-trang-nu', sortOrder: 12 },
  { code: 'WEB-TT-SHORT', name: 'Quần short thi đấu', slug: 'quan-short', sortOrder: 13 },
  { code: 'WEB-BALO', name: 'Balo & Túi thể thao', slug: 'balo-tui', sortOrder: 14 },
  { code: 'WEB-BALO-VOT', name: 'Balo đựng vợt Pickleball', slug: 'balo-vot', sortOrder: 15 },
  { code: 'WEB-TUI-DL', name: 'Túi thể thao du lịch', slug: 'tui-the-thao', sortOrder: 16 },
  { code: 'WEB-PK', name: 'Phụ kiện Pickleball', slug: 'phu-kien', sortOrder: 17 },
  { code: 'WEB-PK-QC', name: 'Quấn cán vợt (Overgrip)', slug: 'quan-can', sortOrder: 18 },
  { code: 'WEB-PK-BV', name: 'Bảo vệ viền vợt & Tẩy mặt vợt', slug: 'bao-ve-vot', sortOrder: 19 },
  { code: 'WEB-PK-NON', name: 'Nón & Băng trán thể thao', slug: 'non-bang-tran', sortOrder: 20 },
];

const STOREFRONT_BRANDS = [
  { code: 'JLA', name: 'JOOLA', slug: 'joola', sortOrder: 1 },
  { code: 'SLK', name: 'Selkirk', slug: 'selkirk', sortOrder: 2 },
  { code: 'CRBN', name: 'CRBN', slug: 'crbn', sortOrder: 3 },
  { code: 'SXZ', name: 'Six Zero', slug: 'six-zero', sortOrder: 4 },
  { code: 'ASC', name: 'ASICS', slug: 'asics', sortOrder: 5 },
  { code: 'MZN', name: 'Mizuno', slug: 'mizuno', sortOrder: 6 },
  { code: 'YNX', name: 'Yonex', slug: 'yonex', sortOrder: 7 },
  { code: '11SP', name: '11 Sport', slug: '11-sport', sortOrder: 8 },
  { code: 'KMT', name: 'Kamito', slug: 'kamito', sortOrder: 9 },
];

const STATIC_PAGES = [
  {
    slug: 'chinh-sach-bao-hanh',
    title: 'Chính sách bảo hành chính hãng 11 Sport',
    contentHtml:
      '<h2>1. Thời hạn bảo hành</h2><p>Toàn bộ vợt Pickleball và giày thể thao chính hãng tại 11 Sport được bảo hành từ 3 đến 12 tháng theo tiêu chuẩn nhà sản xuất.</p><h2>2. Điều kiện bảo hành</h2><p>Sản phẩm còn nguyên tem, hóa đơn mua hàng hoặc số điện thoại tra cứu đơn hàng, phát sinh lỗi kỹ thuật từ nhà sản xuất (nứt lõi, bung keo tự nhiên).</p>',
  },
  {
    slug: 'chinh-sach-doi-tra',
    title: 'Chính sách đổi trả miễn phí trong 7 ngày',
    contentHtml:
      '<h2>1. Phạm vi áp dụng</h2><p>Khách hàng được đổi size hoặc đổi mẫu trong vòng 7 ngày kể từ ngày nhận hàng nếu sản phẩm chưa qua sử dụng, còn nguyên tem mác.</p><h2>2. Quy trình đổi trả</h2><p>Liên hệ hotline 0900 000 011 hoặc mang trực tiếp đến hệ thống showroom 11 Sport để được hỗ trợ ngay.</p>',
  },
  {
    slug: 'chinh-sach-van-chuyen',
    title: 'Chính sách vận chuyển & Kiểm tra hàng',
    contentHtml:
      '<h2>1. Phí vận chuyển</h2><p>Miễn phí vận chuyển toàn quốc cho đơn hàng từ 500.000₫. Đơn dưới 500.000₫ đồng giá 30.000₫.</p><h2>2. Thời gian giao hàng</h2><p>Nội thành TP.HCM & Hà Nội: giao nhanh trong 24h. Các tỉnh thành khác: 2–4 ngày làm việc. Hỗ trợ đồng kiểm trước khi thanh toán.</p>',
  },
  {
    slug: 'chinh-sach-bao-mat',
    title: 'Chính sách bảo mật thông tin khách hàng',
    contentHtml:
      '<h2>1. Thu thập & sử dụng thông tin</h2><p>11 Sport chỉ thu thập họ tên, số điện thoại, email và địa chỉ giao hàng nhằm phục vụ xử lý đơn hàng và bảo hành sản phẩm.</p><h2>2. Cam kết bảo mật</h2><p>Thông tin khách hàng được mã hóa và tuyệt đối không chia sẻ cho bên thứ ba ngoài đơn vị vận chuyển.</p>',
  },
  {
    slug: 'huong-dan-thanh-toan',
    title: 'Hướng dẫn thanh toán COD & Chuyển khoản VietQR',
    contentHtml:
      '<h2>1. Thanh toán khi nhận hàng (COD)</h2><p>Quý khách kiểm tra sản phẩm trước khi thanh toán tiền mặt cho nhân viên giao hàng.</p><h2>2. Thanh toán chuyển khoản QR (PayOS / VietQR)</h2><p>Hệ thống tự động tạo mã QR chính xác số tiền và nội dung đơn hàng. Giao dịch được xác nhận tự động trong vài giây.</p>',
  },
  {
    slug: 'gioi-thieu',
    title: 'Giới thiệu hệ thống thể thao 11 Sport',
    contentHtml:
      '<h2>Về 11 Sport</h2><p>11 Sport là hệ thống bán lẻ vợt Pickleball, giày thể thao, trang phục và phụ kiện chính hãng hàng đầu Việt Nam với 3 showroom tại TP.HCM và Hà Nội.</p><h2>Cam kết</h2><p>100% chính hãng — Tư vấn đúng trình độ — Bảo hành minh bạch.</p>',
  },
];

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/11sport';
  if (!uri.includes('127.0.0.1') && !uri.includes('localhost')) {
    throw new Error(`[SAFETY ABORT] MONGODB_URI (${uri}) không phải Local.`);
  }

  const mode = await connectDatabase();
  console.log(`[Seed Web] Connected (${mode}): ${uri}`);

  // 1. Upsert Categories cho Storefront
  const categoryMap = new Map<string, string>();
  for (const cat of STOREFRONT_CATEGORIES) {
    const existing = await CategoryModel.findOne({
      $or: [{ slug: cat.slug }, { code: cat.code }],
    });
    if (existing) {
      existing.slug = cat.slug;
      existing.isPublishedOnline = true;
      existing.sortOrder = cat.sortOrder;
      if (!existing.descriptionHtml) {
        existing.descriptionHtml = `<p>Khám phá bộ sưu tập <strong>${cat.name}</strong> chính hãng 100% tại 11 Sport — bảo hành đầy đủ, freeship đơn từ 500.000₫.</p>`;
      }
      await existing.save();
      categoryMap.set(cat.slug, existing._id.toString());
    } else {
      const created = await CategoryModel.create({
        code: cat.code,
        name: cat.name,
        slug: cat.slug,
        status: 'ACTIVE',
        isPublishedOnline: true,
        sortOrder: cat.sortOrder,
        descriptionHtml: `<p>Khám phá bộ sưu tập <strong>${cat.name}</strong> chính hãng 100% tại 11 Sport — bảo hành đầy đủ, freeship đơn từ 500.000₫.</p>`,
        seo: {
          title: `${cat.name} Chính Hãng | 11 Sport`,
          description: `Mua ${cat.name} chính hãng giá tốt tại 11 Sport. Bảo hành uy tín, đổi trả 7 ngày, giao nhanh toàn quốc.`,
        },
      });
      categoryMap.set(cat.slug, created._id.toString());
    }
  }

  // Bật online cho các Category hiện có trong DB chưa có slug
  const allCats = await CategoryModel.find({ status: 'ACTIVE' });
  for (const c of allCats) {
    let changed = false;
    if (!c.slug) {
      c.slug = slugifyVi(c.name) || c.code.toLowerCase();
      changed = true;
    }
    if (!c.isPublishedOnline) {
      c.isPublishedOnline = true;
      changed = true;
    }
    if (changed) await c.save().catch(() => {});
  }

  // 2. Upsert Brands cho Storefront
  const brandMap = new Map<string, string>();
  for (const b of STOREFRONT_BRANDS) {
    const existing = await BrandModel.findOne({
      $or: [{ slug: b.slug }, { code: b.code }, { name: b.name }],
    });
    if (existing) {
      existing.slug = b.slug;
      existing.isPublishedOnline = true;
      existing.sortOrder = b.sortOrder;
      await existing.save();
      brandMap.set(b.slug, existing._id.toString());
    } else {
      const created = await BrandModel.create({
        code: b.code,
        name: b.name,
        slug: b.slug,
        status: 'ACTIVE',
        isPublishedOnline: true,
        sortOrder: b.sortOrder,
        descriptionHtml: `<p>Sản phẩm thương hiệu <strong>${b.name}</strong> chính hãng tại 11 Sport.</p>`,
        seo: {
          title: `${b.name} Chính Hãng | 11 Sport`,
          description: `Mua vợt, giày và phụ kiện ${b.name} chính hãng tại 11 Sport.`,
        },
      });
      brandMap.set(b.slug, created._id.toString());
    }
  }

  // Bật online cho Brand hiện có
  const allBrands = await BrandModel.find({ status: 'ACTIVE' });
  for (const b of allBrands) {
    let changed = false;
    if (!b.slug) {
      b.slug = slugifyVi(b.name) || b.code.toLowerCase();
      changed = true;
    }
    if (!b.isPublishedOnline) {
      b.isPublishedOnline = true;
      changed = true;
    }
    if (changed) await b.save().catch(() => {});
  }

  // 3. Bật online + sinh slug cho Products hiện có trong DB
  const existingProducts = await ProductModel.find({});
  const usedSlugs = new Set(existingProducts.map((p) => p.slug).filter(Boolean) as string[]);
  for (const p of existingProducts) {
    let changed = false;
    if (!p.slug) {
      let base = slugifyVi(p.name) || p.code.toLowerCase();
      if (usedSlugs.has(base)) base = `${base}-${p.code.toLowerCase()}`;
      usedSlugs.add(base);
      p.slug = base;
      changed = true;
    }
    if (!p.isPublishedOnline) {
      p.isPublishedOnline = true;
      changed = true;
    }
    if (!p.images || p.images.length === 0) {
      p.images = [{ url: '/images/placeholder-product.svg', alt: p.name, isPrimary: true, sortOrder: 0 }];
      changed = true;
    }
    if (changed) await p.save().catch(() => {});
  }

  // 4. Tạo thêm bộ sản phẩm mẫu Storefront để mỗi danh mục đều có hàng test
  const sampleProducts = [
    {
      code: 'WEBPBJLA01',
      name: 'Vợt Pickleball JOOLA Ben Johns Perseus 3S 16mm',
      slug: 'vot-pickleball-joola-perseus-3s-16mm',
      catSlug: 'vot-carbon-t700',
      brandSlug: 'joola',
      sellingPrice: 5490000,
      compareAtPrice: 6200000,
      isFeatured: true,
      variants: [
        { variantCode: 'WEBPBJLA01DEN16', color: 'Đen Carbon', colorHex: '#1E293B', size: '16mm', stockFloor1: 12, stockFloor2: 5, sellingPrice: 5490000 },
        { variantCode: 'WEBPBJLA01XANH14', color: 'Xanh Emerald', colorHex: '#065F46', size: '14mm', stockFloor1: 8, stockFloor2: 4, sellingPrice: 5490000 },
      ],
    },
    {
      code: 'WEBPBSLK01',
      name: 'Vợt Pickleball Selkirk Vanguard Power Air Invikta',
      slug: 'vot-pickleball-selkirk-vanguard-power-air',
      catSlug: 'vot-chuyen-nghiep',
      brandSlug: 'selkirk',
      sellingPrice: 5890000,
      compareAtPrice: 6500000,
      isFeatured: true,
      variants: [
        { variantCode: 'WEBPBSLK01DO', color: 'Đỏ Crimson', colorHex: '#DC2626', size: 'Standard', stockFloor1: 10, stockFloor2: 5, sellingPrice: 5890000 },
        { variantCode: 'WEBPBSLK01TRANG', color: 'Trắng', colorHex: '#F8FAFC', size: 'Standard', stockFloor1: 6, stockFloor2: 2, sellingPrice: 5890000 },
      ],
    },
    {
      code: 'WEBPBCRBN1',
      name: 'Vợt Carbon T700 CRBN 1X Power Series 16mm',
      slug: 'vot-carbon-t700-crbn-1x-power-16mm',
      catSlug: 'vot-carbon-t700',
      brandSlug: 'crbn',
      sellingPrice: 4690000,
      compareAtPrice: 5200000,
      isFeatured: true,
      variants: [
        { variantCode: 'WEBPBCRBN1DEN', color: 'Đen', colorHex: '#0F172A', size: '16mm', stockFloor1: 15, stockFloor2: 10, sellingPrice: 4690000 },
      ],
    },
    {
      code: 'WEBPB11NEW',
      name: 'Vợt Pickleball Carbon T700 11 Sport Starter Pro',
      slug: 'vot-pickleball-carbon-t700-11sport-starter',
      catSlug: 'vot-nguoi-moi',
      brandSlug: '11-sport',
      sellingPrice: 1490000,
      compareAtPrice: 1890000,
      isFeatured: true,
      variants: [
        { variantCode: 'WEBPB11NEWXANH', color: 'Xanh Lá', colorHex: '#047857', size: '16mm', stockFloor1: 25, stockFloor2: 20, sellingPrice: 1490000 },
        { variantCode: 'WEBPB11NEWCAM', color: 'Cam Năng Động', colorHex: '#EA580C', size: '16mm', stockFloor1: 18, stockFloor2: 10, sellingPrice: 1490000 },
      ],
    },
    {
      code: 'WEBGIAYASC1',
      name: 'Giày Tennis & Pickleball ASICS Court FF 3',
      slug: 'giay-asics-court-ff-3-chinh-hang',
      catSlug: 'giay-pickleball',
      brandSlug: 'asics',
      sellingPrice: 3690000,
      compareAtPrice: 4200000,
      isFeatured: true,
      variants: [
        { variantCode: 'WEBGIAYASC141', color: 'Xanh Navy', colorHex: '#1E3A8A', size: '41', stockFloor1: 8, stockFloor2: 4, sellingPrice: 3690000 },
        { variantCode: 'WEBGIAYASC142', color: 'Xanh Navy', colorHex: '#1E3A8A', size: '42', stockFloor1: 10, stockFloor2: 6, sellingPrice: 3690000 },
      ],
    },
    {
      code: 'WEBAO11PRO',
      name: 'Áo Polo Thể Thao Thi Đấu 11 Sport CoolDry',
      slug: 'ao-polo-the-thao-11-sport-cooldry',
      catSlug: 'ao-nam',
      brandSlug: '11-sport',
      sellingPrice: 349000,
      compareAtPrice: 450000,
      isFeatured: true,
      variants: [
        { variantCode: 'WEBAO11PROM', color: 'Xanh Rêu', colorHex: '#065F46', size: 'M', stockFloor1: 30, stockFloor2: 20, sellingPrice: 349000 },
        { variantCode: 'WEBAO11PROL', color: 'Xanh Rêu', colorHex: '#065F46', size: 'L', stockFloor1: 30, stockFloor2: 20, sellingPrice: 349000 },
      ],
    },
    {
      code: 'WEBBALO01',
      name: 'Balo Đựng Vợt Pickleball 11 Sport Tour 2 Ngăn',
      slug: 'balo-dung-vot-pickleball-11-sport-tour',
      catSlug: 'balo-vot',
      brandSlug: '11-sport',
      sellingPrice: 890000,
      compareAtPrice: 1150000,
      isFeatured: true,
      variants: [
        { variantCode: 'WEBBALO01DEN', color: 'Đen', colorHex: '#0F172A', size: '25L', stockFloor1: 15, stockFloor2: 10, sellingPrice: 890000 },
      ],
    },
    {
      code: 'WEBPKQC01',
      name: 'Hộp 3 Quấn Cán Vợt Pickleball Pro Overgrip',
      slug: 'quan-can-vot-pickleball-pro-overgrip',
      catSlug: 'quan-can',
      brandSlug: '11-sport',
      sellingPrice: 95000,
      compareAtPrice: 120000,
      isFeatured: false,
      variants: [
        { variantCode: 'WEBPKQC01TRANG', color: 'Trắng', colorHex: '#F8FAFC', size: 'Pack 3', stockFloor1: 50, stockFloor2: 50, sellingPrice: 95000 },
        { variantCode: 'WEBPKQC01DEN', color: 'Đen', colorHex: '#0F172A', size: 'Pack 3', stockFloor1: 50, stockFloor2: 50, sellingPrice: 95000 },
      ],
    },
    {
      code: 'WEBPBSXZ01',
      name: 'Vợt Pickleball Six Zero Double Black Diamond 16mm',
      slug: 'vot-pickleball-six-zero-dbd-16mm',
      catSlug: 'vot-carbon-t700',
      brandSlug: 'six-zero',
      sellingPrice: 4390000,
      compareAtPrice: 4850000,
      isFeatured: true,
      variants: [
        { variantCode: 'WEBPBSXZ01DEN', color: 'Đen', colorHex: '#0F172A', size: '16mm', stockFloor1: 12, stockFloor2: 5, sellingPrice: 4390000 },
      ],
    },
    {
      code: 'WEBPBKMT01',
      name: 'Vợt Pickleball Kamito Alpha X Carbon T700',
      slug: 'vot-pickleball-kamito-alpha-x-carbon-t700',
      catSlug: 'vot-chuyen-nghiep',
      brandSlug: 'kamito',
      sellingPrice: 3500000,
      compareAtPrice: 5200000,
      isFeatured: true,
      variants: [
        { variantCode: 'WEBPBKMT01DO', color: 'Đỏ Đen', colorHex: '#DC2626', size: '16mm', stockFloor1: 18, stockFloor2: 8, sellingPrice: 3500000 },
        { variantCode: 'WEBPBKMT01XANH', color: 'Xanh Ngọc', colorHex: '#0D9488', size: '16mm', stockFloor1: 14, stockFloor2: 6, sellingPrice: 3500000 },
      ],
    },
    {
      code: 'WEBTTNU01',
      name: 'Váy Thể Thao Tennis & Pickleball 11 Sport Pro',
      slug: 'vay-the-thao-pickleball-11-sport-pro',
      catSlug: 'thoi-trang-nu',
      brandSlug: '11-sport',
      sellingPrice: 490000,
      compareAtPrice: 590000,
      isFeatured: false,
      variants: [
        { variantCode: 'WEBTTNU01TRANGS', color: 'Trắng', colorHex: '#F8FAFC', size: 'S', stockFloor1: 20, stockFloor2: 10, sellingPrice: 490000 },
        { variantCode: 'WEBTTNU01XANHM', color: 'Xanh Rêu', colorHex: '#065F46', size: 'M', stockFloor1: 20, stockFloor2: 10, sellingPrice: 490000 },
      ],
    },
    {
      code: 'WEBTTSHORT01',
      name: 'Quần Short Thể Thao Thi Đấu 11 Sport AirFlow',
      slug: 'quan-short-the-thao-11-sport-airflow',
      catSlug: 'quan-short',
      brandSlug: '11-sport',
      sellingPrice: 290000,
      compareAtPrice: 360000,
      isFeatured: false,
      variants: [
        { variantCode: 'WEBTTSHORT01DENL', color: 'Đen', colorHex: '#0F172A', size: 'L', stockFloor1: 25, stockFloor2: 15, sellingPrice: 290000 },
      ],
    },
    {
      code: 'WEBTTKMT01',
      name: 'Áo Thun Thể Thao Kamito Match Day DryFit',
      slug: 'ao-thun-the-thao-kamito-match-day',
      catSlug: 'ao-nam',
      brandSlug: 'kamito',
      sellingPrice: 320000,
      compareAtPrice: 390000,
      isFeatured: false,
      variants: [
        { variantCode: 'WEBTTKMT01XANHL', color: 'Xanh Navy', colorHex: '#1E3A8A', size: 'L', stockFloor1: 22, stockFloor2: 10, sellingPrice: 320000 },
      ],
    },
    {
      code: 'WEBGIAYMZN1',
      name: 'Giày Pickleball & Tennis Mizuno Wave Enforce Tour',
      slug: 'giay-mizuno-wave-enforce-tour',
      catSlug: 'giay-pickleball',
      brandSlug: 'mizuno',
      sellingPrice: 3290000,
      compareAtPrice: 3750000,
      isFeatured: true,
      variants: [
        { variantCode: 'WEBGIAYMZN141', color: 'Trắng Xanh', colorHex: '#0284C7', size: '41', stockFloor1: 9, stockFloor2: 5, sellingPrice: 3290000 },
        { variantCode: 'WEBGIAYMZN142', color: 'Trắng Xanh', colorHex: '#0284C7', size: '42', stockFloor1: 11, stockFloor2: 5, sellingPrice: 3290000 },
      ],
    },
    {
      code: 'WEBGIAYYNX1',
      name: 'Giày Sân Cứng Yonex Power Cushion Eclipsion 5',
      slug: 'giay-yonex-power-cushion-eclipsion-5',
      catSlug: 'giay-the-thao',
      brandSlug: 'yonex',
      sellingPrice: 3150000,
      compareAtPrice: 3590000,
      isFeatured: false,
      variants: [
        { variantCode: 'WEBGIAYYNX142', color: 'Đen Vàng', colorHex: '#EAB308', size: '42', stockFloor1: 8, stockFloor2: 4, sellingPrice: 3150000 },
      ],
    },
    {
      code: 'WEBGIAYKMT1',
      name: 'Giày Pickleball Kamito Guard Pro Chống Lật Cổ Chân',
      slug: 'giay-pickleball-kamito-guard-pro',
      catSlug: 'giay-pickleball',
      brandSlug: 'kamito',
      sellingPrice: 1390000,
      compareAtPrice: 1650000,
      isFeatured: false,
      variants: [
        { variantCode: 'WEBGIAYKMT140', color: 'Trắng Xanh', colorHex: '#065F46', size: '40', stockFloor1: 14, stockFloor2: 10, sellingPrice: 1390000 },
      ],
    },
    {
      code: 'WEBTUIJLA1',
      name: 'Túi Đựng Vợt Pickleball JOOLA Vision II Deluxe',
      slug: 'tui-dung-vot-joola-vision-ii-deluxe',
      catSlug: 'tui-the-thao',
      brandSlug: 'joola',
      sellingPrice: 1650000,
      compareAtPrice: 1950000,
      isFeatured: false,
      variants: [
        { variantCode: 'WEBTUIJLA1DEN', color: 'Đen Xám', colorHex: '#334155', size: '40L', stockFloor1: 10, stockFloor2: 5, sellingPrice: 1650000 },
      ],
    },
    {
      code: 'WEBBALOSLK1',
      name: 'Balo Selkirk Team Backpack Chính Hãng',
      slug: 'balo-selkirk-team-backpack',
      catSlug: 'balo-vot',
      brandSlug: 'selkirk',
      sellingPrice: 1890000,
      compareAtPrice: 2200000,
      isFeatured: false,
      variants: [
        { variantCode: 'WEBBALOSLK1DO', color: 'Đỏ Đen', colorHex: '#DC2626', size: '30L', stockFloor1: 8, stockFloor2: 4, sellingPrice: 1890000 },
      ],
    },
    {
      code: 'WEBPKBONG01',
      name: 'Hộp 3 Quả Bóng Pickleball Thi Đấu JOOLA Primo Outdoor',
      slug: 'bong-pickleball-joola-primo-outdoor-hop-3',
      catSlug: 'bong-pickleball',
      brandSlug: 'joola',
      sellingPrice: 245000,
      compareAtPrice: 290000,
      isFeatured: false,
      variants: [
        { variantCode: 'WEBPKBONG01VANG', color: 'Vàng Neon', colorHex: '#BEF264', size: 'Hộp 3', stockFloor1: 40, stockFloor2: 40, sellingPrice: 245000 },
      ],
    },
    {
      code: 'WEBPKBV01',
      name: 'Băng Dán Bảo Vệ Viền Vợt Carbon Edge Guard 11 Sport',
      slug: 'bang-dan-bao-ve-vien-vot-11-sport',
      catSlug: 'bao-ve-vot',
      brandSlug: '11-sport',
      sellingPrice: 65000,
      compareAtPrice: 90000,
      isFeatured: false,
      variants: [
        { variantCode: 'WEBPKBV01DEN', color: 'Đen', colorHex: '#0F172A', size: '16mm', stockFloor1: 60, stockFloor2: 60, sellingPrice: 65000 },
      ],
    },
    {
      code: 'WEBPKNON01',
      name: 'Nón Lưỡi Trai Thể Thao Pickleball 11 Sport DryFit',
      slug: 'non-luoi-trai-the-thao-11-sport',
      catSlug: 'non-bang-tran',
      brandSlug: '11-sport',
      sellingPrice: 195000,
      compareAtPrice: 250000,
      isFeatured: false,
      variants: [
        { variantCode: 'WEBPKNON01XANH', color: 'Xanh Rêu', colorHex: '#065F46', size: 'FreeSize', stockFloor1: 30, stockFloor2: 20, sellingPrice: 195000 },
      ],
    },
  ];

  for (const sp of sampleProducts) {
    const exists = await ProductModel.findOne({ $or: [{ code: sp.code }, { slug: sp.slug }] });
    if (!exists) {
      await ProductModel.create({
        code: sp.code,
        name: sp.name,
        slug: sp.slug,
        categoryId: categoryMap.get(sp.catSlug) || '',
        brandId: brandMap.get(sp.brandSlug) || '',
        unit: 'Cái',
        costPrice: Math.round(sp.sellingPrice * 0.65),
        sellingPrice: sp.sellingPrice,
        compareAtPrice: sp.compareAtPrice,
        stockFloor1: sp.variants.reduce((s, v) => s + v.stockFloor1, 0),
        stockFloor2: sp.variants.reduce((s, v) => s + v.stockFloor2, 0),
        isPublishedOnline: true,
        isFeatured: sp.isFeatured,
        images: [{ url: '/images/placeholder-product.svg', alt: sp.name, isPrimary: true, sortOrder: 0 }],
        shortDescription: `${sp.name} chính hãng tại 11 Sport, hỗ trợ bảo hành và đổi trả 7 ngày.`,
        descriptionHtml: `<p><strong>${sp.name}</strong> được phân phối chính hãng tại 11 Sport. Thiết kế tối ưu hiệu suất thi đấu, kiểm soát bóng vượt trội.</p>`,
        specs: [
          { label: 'Thương hiệu', value: sp.brandSlug.toUpperCase() },
          { label: 'Bảo hành', value: 'Chính hãng 6 tháng' },
        ],
        variants: sp.variants.map((v) => ({
          ...v,
          imageUrl: '/images/placeholder-product.svg',
          costPrice: Math.round(v.sellingPrice * 0.65),
          stock: v.stockFloor1 + v.stockFloor2,
        })),
        tierPricing: [
          { minQty: 2, discountType: 'PERCENT', discountValue: 5 },
          { minQty: 5, discountType: 'PERCENT', discountValue: 10 },
        ],
        seo: {
          title: `${sp.name} | 11 Sport`,
          description: `Mua ${sp.name} chính hãng tại 11 Sport. Freeship đơn từ 500k, bảo hành chính hãng.`,
        },
      });
    }
  }

  // 5. Upsert Static Pages
  for (const page of STATIC_PAGES) {
    await WebStaticPageModel.findOneAndUpdate(
      { slug: page.slug },
      {
        $set: {
          title: page.title,
          slug: page.slug,
          contentHtml: page.contentHtml,
          status: 'PUBLISHED',
          seo: {
            title: `${page.title} | 11 Sport`,
            description: `${page.title} tại hệ thống thể thao 11 Sport.`,
          },
        },
      },
      { upsert: true, new: true }
    );
  }

  // 6. Upsert Article Category & Sample Articles
  const artCat = await WebArticleCategoryModel.findOneAndUpdate(
    { slug: 'huong-dan-pickleball' },
    { $set: { name: 'Hướng dẫn Pickleball', slug: 'huong-dan-pickleball', sortOrder: 1, isActive: true } },
    { upsert: true, new: true }
  );

  const sampleArticles = [
    {
      slug: 'cach-chon-vot-pickleball-cho-nguoi-moi',
      title: 'Cách chọn vợt Pickleball phù hợp cho người mới bắt đầu (2026)',
      excerpt: 'Hướng dẫn chi tiết cách chọn độ dày mặt vợt 14mm hay 16mm, trọng lượng và chất liệu Carbon T700.',
      contentHtml:
        '<h2>1. Chọn độ dày mặt vợt (14mm vs 16mm)</h2><p>Vợt 16mm mang lại khả năng kiểm soát và giảm chấn tốt cho người mới. Vợt 14mm thiên về lực đánh và tốc độ vung.</p><h2>2. Chất liệu Carbon T700</h2><p>Bề mặt Raw Carbon T700 giúp tăng độ xoáy (spin) và độ bền lâu dài.</p>',
    },
    {
      slug: 'top-5-giay-pickleball-chong-truot-tot-nhat',
      title: 'Top 5 đôi giày Pickleball bám sân, bảo vệ cổ chân tốt nhất',
      excerpt: 'So sánh ASICS Court FF 3, Gel-Resolution 9 và các mẫu giày sân cứng được VĐV tin dùng.',
      contentHtml:
        '<h2>1. Tiêu chí chọn giày Pickleball</h2><p>Ưu tiên đế non-marking xương cá, khung ổn định ngang (lateral stability) để tránh lật cổ chân khi di chuyển nhanh.</p>',
    },
  ];
  for (const a of sampleArticles) {
    await WebArticleModel.findOneAndUpdate(
      { slug: a.slug },
      {
        $set: {
          ...a,
          categoryId: artCat._id.toString(),
          thumbnailUrl: '/images/placeholder-product.svg',
          tags: ['pickleball', '11sport'],
          status: 'PUBLISHED',
          publishedAt: new Date(),
          seo: { title: `${a.title} | 11 Sport`, description: a.excerpt },
        },
      },
      { upsert: true, new: true }
    );
  }

  // 7. Banners & Home Sections (đồng bộ layout mipik.vn)
  const bannerSeeds = [
    {
      title: 'Khai trương Storefront 11 Sport',
      position: 'HERO',
      desktopImageUrl: '/images/banner-hero-1.svg',
      mobileImageUrl: '/images/banner-hero-mobile-1.svg',
      linkUrl: '/danh-muc/vot-pickleball',
      altText: '11 Sport Pickleball & Thể thao chính hãng',
      status: 'ACTIVE',
      sortOrder: 1,
    },
    {
      title: 'Ưu đãi Vợt Carbon T700 Pro',
      position: 'HERO',
      desktopImageUrl: '/images/banner-hero-2.svg',
      mobileImageUrl: '/images/banner-hero-mobile-1.svg',
      linkUrl: '/danh-muc/vot-carbon-t700',
      altText: 'Vợt Carbon T700 Pro giảm đến 10% khi mua combo',
      status: 'ACTIVE',
      sortOrder: 2,
    },
    {
      title: 'Bộ sưu tập Thời trang Thi đấu 11 Sport',
      position: 'INLINE_1',
      desktopImageUrl: '/images/banner-inline-1.svg',
      mobileImageUrl: '/images/banner-inline-1.svg',
      linkUrl: '/danh-muc/thoi-trang',
      altText: 'Thời trang thi đấu 11 Sport CoolDry',
      status: 'ACTIVE',
      sortOrder: 3,
    },
    {
      title: 'Giày Sân Cứng ASICS & Mizuno Chính Hãng',
      position: 'INLINE_2',
      desktopImageUrl: '/images/banner-inline-2.svg',
      mobileImageUrl: '/images/banner-inline-2.svg',
      linkUrl: '/danh-muc/giay-the-thao',
      altText: 'Giày sân cứng chính hãng bảo vệ cổ chân',
      status: 'ACTIVE',
      sortOrder: 4,
    },
  ];
  for (const b of bannerSeeds) {
    await WebBannerModel.findOneAndUpdate(
      { title: b.title },
      { $set: b },
      { upsert: true, new: true }
    );
  }

  // Làm mới bố cục trang chủ khớp wireframe docs/design/storefront-v1.md & mipik.vn
  await WebHomeSectionModel.deleteMany({});
  await WebHomeSectionModel.insertMany([
    { type: 'HERO', title: 'Banner Chính', isActive: true, sortOrder: 1 },
    { type: 'USP', title: 'Cam kết dịch vụ 11 Sport', isActive: true, sortOrder: 2 },
    { type: 'FLASH_SALE', title: 'Flash Sale Trong Ngày', viewAllUrl: '/danh-muc/vot-pickleball', isActive: true, sortOrder: 3 },
    {
      type: 'CATEGORY_GRID',
      title: 'VỢT PICKLEBALL',
      subtitle: 'Tuyển chọn vợt Carbon T700 & vợt thi đấu chính hãng',
      viewAllUrl: '/danh-muc/vot-pickleball',
      configJson: {
        categorySlug: 'vot-pickleball',
        categorySlugs: ['vot-pickleball', 'vot-carbon-t700', 'vot-nguoi-moi', 'vot-chuyen-nghiep'],
        limit: 10,
      },
      isActive: true,
      sortOrder: 4,
    },
    { type: 'CUSTOM_BANNER', title: 'Banner Thời Trang 11 Sport', isActive: true, sortOrder: 5 },
    {
      type: 'CATEGORY_CAROUSEL',
      title: 'THỜI TRANG 11 SPORT',
      subtitle: 'Trang phục thi đấu thoáng khí, co giãn 4 chiều',
      viewAllUrl: '/danh-muc/thoi-trang',
      configJson: {
        categorySlug: 'thoi-trang',
        categorySlugs: ['thoi-trang', 'ao-nam', 'thoi-trang-nu', 'quan-short'],
        limit: 8,
      },
      isActive: true,
      sortOrder: 6,
    },
    { type: 'CUSTOM_BANNER', title: 'Banner Giày Thể Thao', isActive: true, sortOrder: 7 },
    {
      type: 'CATEGORY_CAROUSEL',
      title: 'GIÀY THỂ THAO',
      subtitle: 'Giày sân cứng Asics, Mizuno, Yonex, Kamito chính hãng',
      viewAllUrl: '/danh-muc/giay-the-thao',
      configJson: {
        categorySlug: 'giay-the-thao',
        categorySlugs: ['giay-the-thao', 'giay-pickleball', 'giay-cau-long', 'vo-the-thao'],
        limit: 8,
      },
      isActive: true,
      sortOrder: 8,
    },
    {
      type: 'CATEGORY_CAROUSEL',
      title: 'TÚI - BALO',
      subtitle: 'Balo đựng vợt chuyên dụng & túi du lịch thể thao',
      viewAllUrl: '/danh-muc/balo-tui',
      configJson: {
        categorySlug: 'balo-tui',
        categorySlugs: ['balo-tui', 'balo-vot', 'tui-the-thao'],
        limit: 8,
      },
      isActive: true,
      sortOrder: 9,
    },
    {
      type: 'CATEGORY_GRID',
      title: 'PHỤ KIỆN PICKLEBALL',
      subtitle: 'Bóng thi đấu, quấn cán Overgrip, bảo vệ viền vợt',
      viewAllUrl: '/danh-muc/phu-kien',
      configJson: {
        categorySlug: 'phu-kien',
        categorySlugs: ['phu-kien', 'quan-can', 'bao-ve-vot', 'non-bang-tran', 'bong-pickleball'],
        limit: 10,
      },
      isActive: true,
      sortOrder: 10,
    },
    { type: 'BRANDS', title: 'Thương hiệu đối tác chính hãng', isActive: true, sortOrder: 11 },
    { type: 'BLOG', title: 'Kiến thức & Kinh nghiệm chọn đồ', viewAllUrl: '/tin-tuc', isActive: true, sortOrder: 12 },
  ]);

  // 8. Site Setting mặc định
  if ((await WebSiteSettingModel.countDocuments()) === 0) {
    await WebSiteSettingModel.create({
      siteName: '11 Sport',
      hotline: '0900 000 011',
      email: 'cskh@11sport.vn',
      zaloUrl: 'https://zalo.me/11sport',
      messengerUrl: 'https://m.me/11sport.vn',
      defaultShippingFee: 30000,
      freeShippingThreshold: 500000,
      onlineStockMode: 'FLOOR_1',
    });
  }

  // 9. Flash Sale / Coupon mẫu
  const flashEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  await PromotionModel.findOneAndUpdate(
    { code: 'KM-FLASH-01' },
    {
      $set: {
        code: 'KM-FLASH-01',
        name: 'FLASH SALE 11 SPORT — GIẢM SỐC HÔM NAY',
        type: 'BILL_DISCOUNT',
        applyChannels: ['ONLINE'],
        isFlashSale: true,
        isCouponRequired: false,
        conditionType: 'ALL_PRODUCTS',
        discountType: 'PERCENT',
        discountValue: 10,
        startDate: new Date(),
        endDate: flashEnd,
        status: 'ACTIVE',
      },
    },
    { upsert: true, new: true }
  );

  if ((await PromotionModel.countDocuments({ couponCode: '11SPORT50K' })) === 0) {
    const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await PromotionModel.create({
      code: 'KM-WEB-01',
      name: 'Ưu đãi khai trương Web 11 Sport',
      type: 'BILL_DISCOUNT',
      applyChannels: ['ONLINE'],
      isCouponRequired: true,
      couponCode: '11SPORT50K',
      discountType: 'FIXED',
      discountValue: 50000,
      minOrderAmount: 500000,
      startDate: new Date(),
      endDate: end,
      status: 'ACTIVE',
    });
  }

  console.log('[Seed Web] Hoàn tất seed dữ liệu Storefront!');
  await disconnectDatabase();
}

main().catch((err) => {
  console.error('[Seed Web] Lỗi:', err);
  process.exit(1);
});
