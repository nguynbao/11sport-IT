import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Router, Request, Response, NextFunction } from 'express';
import {
  brandRepo,
  categoryRepo,
  orderRepo,
  productRepo,
  promotionRepo,
  stockMovementRepo,
  webArticleCategoryRepo,
  webArticleRepo,
  webAuditLogRepo,
  webBannerRepo,
  webHomeSectionRepo,
  webMenuRepo,
  webRedirectRepo,
  webReviewRepo,
  webSiteSettingRepo,
  webStaticPageRepo,
} from '../config/db';
import { requireRoles } from '../middleware/auth';
import { atomicRestoreOnlineStock, getOnlineSiteSetting } from '../services/webStockAndPricing';
import { ApiError } from '../utils/errors';
import { invalidateWebCache } from '../utils/webCache';

export const cmsWebRouter = Router();

// RBAC chung: Chỉ ADMIN và CEO được truy cập /api/v1/cms/web/*
cmsWebRouter.use(
  requireRoles(['ADMIN', 'CEO'], 'Chỉ ADMIN hoặc CEO mới có quyền truy cập Quản lý Website')
);

function requireAdminOnly(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role !== 'ADMIN') {
    next(new ApiError(403, 'ADMIN_ONLY', 'Chỉ ADMIN mới được phép thay đổi cấu hình kỹ thuật hệ thống'));
    return;
  }
  next();
}

async function writeAuditLog(
  req: Request,
  action: string,
  entityType: string,
  entityId: string,
  diffSummary: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await webAuditLogRepo.create({
    actorId: req.user?.userId || 'UNKNOWN',
    actorName: req.user?.fullName || req.user?.username || 'Admin',
    actorRole: req.user?.role || 'ADMIN',
    action,
    entityType,
    entityId,
    diffSummary,
    metadata,
  });
}

// ==================== 1. DASHBOARD CEO & AUDIT LOG ====================

cmsWebRouter.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const fromDate = req.query.from
      ? new Date(String(req.query.from))
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const toDate = req.query.to ? new Date(String(req.query.to)) : now;

    const [onlineOrders, pendingReviews, recentLogs] = await Promise.all([
      orderRepo.find({ channel: 'ONLINE' }, { createdAt: -1 }),
      webReviewRepo.find({ status: 'PENDING' }),
      webAuditLogRepo.find({}, { createdAt: -1 }),
    ]);

    const periodOrders = onlineOrders.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return t >= fromDate.getTime() && t <= toDate.getTime();
    });

    const paidOrders = periodOrders.filter(
      (o) => o.paymentStatus === 'PAID' || (o.paymentGateway === 'COD' && o.fulfillmentStatus !== 'CANCELLED')
    );
    const totalRevenue = paidOrders.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    const qrOrders = periodOrders.filter((o) => o.paymentGateway === 'PAYOS' || o.paymentGateway === 'VIETQR');
    const qrPaid = qrOrders.filter((o) => o.paymentStatus === 'PAID');
    const qrSuccessRate = qrOrders.length > 0 ? Math.round((qrPaid.length / qrOrders.length) * 100) : 0;

    // Top 10 sản phẩm bán chạy Online
    const productStats = new Map<string, { productId: string; productName: string; quantity: number; revenue: number }>();
    for (const o of paidOrders) {
      for (const it of o.items || []) {
        if (it.isGift) continue;
        const pid = String(it.productId);
        const cur = productStats.get(pid) || {
          productId: pid,
          productName: it.productName,
          quantity: 0,
          revenue: 0,
        };
        cur.quantity += Number(it.quantity || 0);
        cur.revenue += Number(it.lineTotal || 0);
        productStats.set(pid, cur);
      }
    }
    const topProducts = Array.from(productStats.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    res.json({
      data: {
        totalRevenue,
        totalOrders: periodOrders.length,
        paidOrdersCount: paidOrders.length,
        qrOrdersCount: qrOrders.length,
        qrSuccessRate,
        pendingReviewsCount: pendingReviews.length,
        topProducts,
        recentAuditLogs: recentLogs.slice(0, 5),
      },
    });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.get('/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const entityType = String(req.query.entityType || '').trim();
    const action = String(req.query.action || '').trim();

    const filter: Record<string, unknown> = {};
    if (entityType) filter.entityType = entityType;
    if (action) filter.action = action;

    const logs = await webAuditLogRepo.find(filter, { createdAt: -1 });
    const paged = logs.slice((page - 1) * limit, page * limit);
    res.json({
      data: paged,
      meta: { total: logs.length, page, limit },
    });
  } catch (err) {
    next(err);
  }
});

// ==================== 2. REVALIDATE & UPLOAD ====================

cmsWebRouter.post('/revalidate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    invalidateWebCache();
    const paths = Array.isArray(req.body?.paths) ? req.body.paths : ['/'];
    const tags = Array.isArray(req.body?.tags) ? req.body.tags : ['home', 'menu'];

    const setting = await getOnlineSiteSetting();
    const shopUrl = (process.env.SHOP_URL || '').replace(/\/+$/, '');
    const secret = (setting as any).revalidateSecret || process.env.REVALIDATE_SECRET || '';

    let shopNotified = false;
    let shopError = '';
    if (shopUrl) {
      try {
        const resp = await fetch(`${shopUrl}/api/revalidate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(secret ? { 'x-revalidate-secret': secret } : {}),
          },
          body: JSON.stringify({ paths, tags }),
        });
        shopNotified = resp.ok;
        if (!resp.ok) shopError = `HTTP ${resp.status}`;
      } catch (e: any) {
        shopError = e?.message || 'Fetch error';
      }
    }

    await writeAuditLog(req, 'REVALIDATE', 'WebCache', 'ALL', `Làm mới cache paths=${paths.join(',')}`);
    res.json({
      data: {
        serverCacheCleared: true,
        shopNotified,
        ...(shopError ? { shopError } : {}),
      },
    });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.post('/upload', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dataUrl, dataBase64, mimeType, fileName } = req.body || {};
    let resolvedMime = String(mimeType || '').toLowerCase();
    let rawBase64 = String(dataBase64 || '');

    if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
      const match = /^data:(image\/[a-z0-9+.-]+);base64,(.+)$/i.exec(dataUrl);
      if (!match) {
        throw new ApiError(400, 'INVALID_IMAGE', 'Định dạng dataUrl ảnh không hợp lệ');
      }
      resolvedMime = match[1].toLowerCase();
      rawBase64 = match[2];
    }

    const allowedMimes: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    const ext = allowedMimes[resolvedMime];
    if (!ext || !rawBase64) {
      throw new ApiError(400, 'INVALID_IMAGE_TYPE', 'Chỉ hỗ trợ ảnh JPG, PNG, WEBP, GIF');
    }

    const buf = Buffer.from(rawBase64, 'base64');
    if (buf.length > 5 * 1024 * 1024) {
      throw new ApiError(400, 'IMAGE_TOO_LARGE', 'Kích thước ảnh tối đa 5MB');
    }

    const siteSetting = await getOnlineSiteSetting().catch(() => null);
    const cloudName = String(siteSetting?.cloudinaryCloudName || process.env.CLOUDINARY_CLOUD_NAME || '').trim();
    const apiKey = String(siteSetting?.cloudinaryApiKey || process.env.CLOUDINARY_API_KEY || '').trim();
    const apiSecret = String(siteSetting?.cloudinaryApiSecret || process.env.CLOUDINARY_API_SECRET || '').trim();
    const cloudFolder = String(siteSetting?.cloudinaryFolder || process.env.CLOUDINARY_FOLDER || '11sport-web').trim() || '11sport-web';

    if (cloudName && apiKey && apiSecret) {
      const timestamp = Math.floor(Date.now() / 1000);
      const signatureBase = `folder=${cloudFolder}&timestamp=${timestamp}${apiSecret}`;
      const signature = crypto.createHash('sha1').update(signatureBase).digest('hex');

      const form = new URLSearchParams();
      form.set('file', `data:${resolvedMime};base64,${rawBase64}`);
      form.set('api_key', apiKey);
      form.set('timestamp', String(timestamp));
      form.set('folder', cloudFolder);
      form.set('signature', signature);

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      const uploadJson: any = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok || !uploadJson?.secure_url) {
        const msg = uploadJson?.error?.message || 'Upload ảnh lên Cloudinary thất bại';
        throw new ApiError(502, 'CLOUDINARY_UPLOAD_FAILED', msg);
      }

      const url = String(uploadJson.secure_url);
      const publicId = String(uploadJson.public_id || '');
      await writeAuditLog(req, 'UPLOAD', 'WebMedia', publicId || url, `Upload Cloudinary ${url} (${buf.length} bytes)`);
      res.status(201).json({
        data: {
          url,
          publicId,
          provider: 'cloudinary',
          size: buf.length,
          mimeType: resolvedMime,
        },
      });
      return;
    }

    const uploadDir = path.resolve(process.cwd(), 'uploads', 'web');
    fs.mkdirSync(uploadDir, { recursive: true });

    const safeBase = String(fileName || 'img')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 32);
    const outName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeBase || 'web'}.${ext}`;
    fs.writeFileSync(path.join(uploadDir, outName), buf);

    const url = `/uploads/web/${outName}`;
    await writeAuditLog(req, 'UPLOAD', 'WebMedia', outName, `Upload ảnh local ${url} (${buf.length} bytes)`);
    res.status(201).json({ data: { url, provider: 'local', size: buf.length, mimeType: resolvedMime } });
  } catch (err) {
    next(err);
  }
});

// ==================== 3. BANNERS ====================

cmsWebRouter.get('/banners', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await webBannerRepo.find({}, { sortOrder: 1, createdAt: -1 });
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.post('/banners', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, position, desktopImageUrl, mobileImageUrl, linkUrl, altText, startDate, endDate, status, sortOrder } =
      req.body || {};
    if (!title || !desktopImageUrl || !mobileImageUrl) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Tiêu đề, ảnh desktop và ảnh mobile là bắt buộc');
    }
    const created = await webBannerRepo.create({
      title: String(title).trim(),
      position: position || 'HERO',
      desktopImageUrl: String(desktopImageUrl).trim(),
      mobileImageUrl: String(mobileImageUrl).trim(),
      linkUrl: String(linkUrl || '').trim(),
      altText: String(altText || '').trim(),
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      status: status || 'DRAFT',
      sortOrder: Number(sortOrder || 0),
      createdBy: req.user?.userId || '',
      updatedBy: req.user?.userId || '',
    });
    invalidateWebCache('public:home');
    await writeAuditLog(req, 'CREATE', 'WebBanner', String(created._id), `Tạo banner "${created.title}"`);
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.patch('/banners/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await webBannerRepo.updateById(String(req.params.id), {
      ...(req.body || {}),
      updatedBy: req.user?.userId || '',
    });
    if (!updated) throw new ApiError(404, 'BANNER_NOT_FOUND', 'Không tìm thấy banner');
    invalidateWebCache('public:home');
    await writeAuditLog(req, 'UPDATE', 'WebBanner', String(updated._id), `Cập nhật banner "${updated.title}"`);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.delete('/banners/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ok = await webBannerRepo.deleteById(String(req.params.id));
    if (!ok) throw new ApiError(404, 'BANNER_NOT_FOUND', 'Không tìm thấy banner');
    invalidateWebCache('public:home');
    await writeAuditLog(req, 'DELETE', 'WebBanner', String(req.params.id), `Xóa banner ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ==================== 4. HOME SECTIONS ====================

cmsWebRouter.get('/home-sections', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await webHomeSectionRepo.find({}, { sortOrder: 1 });
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.post('/home-sections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, title, subtitle, viewAllUrl, configJson, isActive, sortOrder } = req.body || {};
    if (!type || !title) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Loại section và tiêu đề là bắt buộc');
    }
    const created = await webHomeSectionRepo.create({
      type,
      title: String(title).trim(),
      subtitle: String(subtitle || '').trim(),
      viewAllUrl: String(viewAllUrl || '').trim(),
      configJson: configJson || {},
      isActive: isActive !== false,
      sortOrder: Number(sortOrder || 0),
      updatedBy: req.user?.userId || '',
    });
    invalidateWebCache('public:home');
    await writeAuditLog(req, 'CREATE', 'WebHomeSection', String(created._id), `Tạo section "${created.title}"`);
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.put('/home-sections/reorder', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = Array.isArray(req.body?.sections) ? req.body.sections : [];
    for (const item of list) {
      if (!item.id) continue;
      await webHomeSectionRepo.updateById(String(item.id), {
        sortOrder: Number(item.sortOrder || 0),
        ...(typeof item.isActive === 'boolean' ? { isActive: item.isActive } : {}),
        updatedBy: req.user?.userId || '',
      });
    }
    invalidateWebCache('public:home');
    await writeAuditLog(req, 'REORDER', 'WebHomeSection', 'BATCH', `Sắp xếp lại ${list.length} section trang chủ`);
    const updated = await webHomeSectionRepo.find({}, { sortOrder: 1 });
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.patch('/home-sections/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await webHomeSectionRepo.updateById(String(req.params.id), {
      ...(req.body || {}),
      updatedBy: req.user?.userId || '',
    });
    if (!updated) throw new ApiError(404, 'SECTION_NOT_FOUND', 'Không tìm thấy section');
    invalidateWebCache('public:home');
    await writeAuditLog(req, 'UPDATE', 'WebHomeSection', String(updated._id), `Cập nhật section "${updated.title}"`);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.delete('/home-sections/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ok = await webHomeSectionRepo.deleteById(String(req.params.id));
    if (!ok) throw new ApiError(404, 'SECTION_NOT_FOUND', 'Không tìm thấy section');
    invalidateWebCache('public:home');
    await writeAuditLog(req, 'DELETE', 'WebHomeSection', String(req.params.id), `Xóa section ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ==================== 5. MENUS ====================

cmsWebRouter.get('/menus', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await webMenuRepo.find({}, { sortOrder: 1 });
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.post('/menus', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { label, url, parentId, icon, badge, sortOrder, isActive, openInNewTab } = req.body || {};
    if (!label || !url) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Tên menu và đường dẫn là bắt buộc');
    }
    const created = await webMenuRepo.create({
      label: String(label).trim(),
      url: String(url).trim(),
      parentId: parentId || null,
      icon: String(icon || '').trim(),
      badge: String(badge || '').trim(),
      sortOrder: Number(sortOrder || 0),
      isActive: isActive !== false,
      openInNewTab: Boolean(openInNewTab),
    });
    invalidateWebCache('public:menu');
    await writeAuditLog(req, 'CREATE', 'WebMenu', String(created._id), `Tạo menu "${created.label}"`);
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.put('/menus/reorder', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = Array.isArray(req.body?.menus) ? req.body.menus : [];
    for (const item of list) {
      if (!item.id) continue;
      await webMenuRepo.updateById(String(item.id), {
        sortOrder: Number(item.sortOrder || 0),
        ...(item.parentId !== undefined ? { parentId: item.parentId } : {}),
      });
    }
    invalidateWebCache('public:menu');
    await writeAuditLog(req, 'REORDER', 'WebMenu', 'BATCH', `Cập nhật thứ tự ${list.length} mục menu`);
    const updated = await webMenuRepo.find({}, { sortOrder: 1 });
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.patch('/menus/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await webMenuRepo.updateById(String(req.params.id), req.body || {});
    if (!updated) throw new ApiError(404, 'MENU_NOT_FOUND', 'Không tìm thấy mục menu');
    invalidateWebCache('public:menu');
    await writeAuditLog(req, 'UPDATE', 'WebMenu', String(updated._id), `Cập nhật menu "${updated.label}"`);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.delete('/menus/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ok = await webMenuRepo.deleteById(String(req.params.id));
    if (!ok) throw new ApiError(404, 'MENU_NOT_FOUND', 'Không tìm thấy mục menu');
    invalidateWebCache('public:menu');
    await writeAuditLog(req, 'DELETE', 'WebMenu', String(req.params.id), `Xóa menu ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ==================== 6. CATEGORIES, BRANDS & PRODUCTS WEB ====================

cmsWebRouter.get('/categories', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await categoryRepo.find({}, { sortOrder: 1, name: 1 });
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.patch('/categories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug, imageUrl, descriptionHtml, isPublishedOnline, sortOrder, seo } = req.body || {};
    const patch: Record<string, unknown> = {};
    if (slug !== undefined) patch.slug = String(slug).trim().toLowerCase();
    if (imageUrl !== undefined) patch.imageUrl = String(imageUrl).trim();
    if (descriptionHtml !== undefined) patch.descriptionHtml = String(descriptionHtml);
    if (typeof isPublishedOnline === 'boolean') patch.isPublishedOnline = isPublishedOnline;
    if (sortOrder !== undefined) patch.sortOrder = Number(sortOrder);
    if (seo !== undefined) patch.seo = seo;

    const updated = await categoryRepo.updateById(String(req.params.id), patch);
    if (!updated) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Không tìm thấy danh mục');
    invalidateWebCache('public:home');
    await writeAuditLog(req, 'UPDATE', 'CategoryWeb', String(updated._id), `Cập nhật Web cho danh mục "${updated.name}"`);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.get('/brands', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await brandRepo.find({}, { sortOrder: 1, name: 1 });
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.patch('/brands/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug, logoUrl, descriptionHtml, isPublishedOnline, sortOrder, seo } = req.body || {};
    const patch: Record<string, unknown> = {};
    if (slug !== undefined) patch.slug = String(slug).trim().toLowerCase();
    if (logoUrl !== undefined) patch.logoUrl = String(logoUrl).trim();
    if (descriptionHtml !== undefined) patch.descriptionHtml = String(descriptionHtml);
    if (typeof isPublishedOnline === 'boolean') patch.isPublishedOnline = isPublishedOnline;
    if (sortOrder !== undefined) patch.sortOrder = Number(sortOrder);
    if (seo !== undefined) patch.seo = seo;

    const updated = await brandRepo.updateById(String(req.params.id), patch);
    if (!updated) throw new ApiError(404, 'BRAND_NOT_FOUND', 'Không tìm thấy thương hiệu');
    invalidateWebCache('public:home');
    await writeAuditLog(req, 'UPDATE', 'BrandWeb', String(updated._id), `Cập nhật Web cho thương hiệu "${updated.name}"`);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.get('/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const published = req.query.isPublishedOnline;
    const products = await productRepo.find({}, { updatedAt: -1 });
    const filtered = products.filter((p) => {
      if (published === 'true' && !p.isPublishedOnline) return false;
      if (published === 'false' && p.isPublishedOnline) return false;
      if (q && !`${p.name} ${p.code} ${p.slug || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    res.json({ data: filtered });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.patch('/products/:id/web', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await productRepo.findById(String(req.params.id));
    if (!existing) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm');

    const {
      slug,
      isPublishedOnline,
      isFeatured,
      compareAtPrice,
      images,
      variantImages,
      shortDescription,
      descriptionHtml,
      specs,
      seo,
    } = req.body || {};

    const patch: Record<string, unknown> = {};
    if (slug !== undefined) patch.slug = String(slug).trim().toLowerCase();
    if (typeof isPublishedOnline === 'boolean') patch.isPublishedOnline = isPublishedOnline;
    if (typeof isFeatured === 'boolean') patch.isFeatured = isFeatured;
    if (compareAtPrice !== undefined) patch.compareAtPrice = Number(compareAtPrice || 0);
    if (Array.isArray(images)) patch.images = images;
    if (shortDescription !== undefined) patch.shortDescription = String(shortDescription);
    if (descriptionHtml !== undefined) patch.descriptionHtml = String(descriptionHtml);
    if (Array.isArray(specs)) patch.specs = specs;
    if (seo !== undefined) patch.seo = seo;

    if (Array.isArray(variantImages) && Array.isArray(existing.variants)) {
      const imgMapByKey = new Map<string, string>();
      const imgMapByColor = new Map<string, string>();
      for (const vi of variantImages) {
        if (!vi || typeof vi !== 'object') continue;
        const img = typeof vi.imageUrl === 'string' ? vi.imageUrl.trim() : '';
        if (vi.variantKey) {
          imgMapByKey.set(String(vi.variantKey), img);
        }
        if (vi.color) {
          imgMapByColor.set(String(vi.color).trim().toLowerCase(), img);
        }
      }
      patch.variants = existing.variants.map((v) => {
        const cKey = String(v.color || '').trim().toLowerCase();
        let nextImg = v.imageUrl || '';
        if (imgMapByKey.has(v.variantKey)) {
          nextImg = imgMapByKey.get(v.variantKey) || '';
        } else if (cKey && imgMapByColor.has(cKey)) {
          nextImg = imgMapByColor.get(cKey) || '';
        }
        return {
          ...v,
          imageUrl: nextImg,
        };
      });
    }

    const updated = await productRepo.updateById(String(existing._id), patch);
    invalidateWebCache('public:home');
    await writeAuditLog(req, 'UPDATE', 'ProductWeb', String(existing._id), `Cập nhật thông tin Web SP "${existing.name}"`);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// ==================== 7. ARTICLES, ARTICLE CATEGORIES & STATIC PAGES ====================

cmsWebRouter.get('/article-categories', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await webArticleCategoryRepo.find({}, { sortOrder: 1 });
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.post('/article-categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, slug, description, sortOrder, isActive, seo } = req.body || {};
    if (!name || !slug) throw new ApiError(400, 'VALIDATION_ERROR', 'Tên và slug là bắt buộc');
    const created = await webArticleCategoryRepo.create({
      name: String(name).trim(),
      slug: String(slug).trim().toLowerCase(),
      description: String(description || ''),
      sortOrder: Number(sortOrder || 0),
      isActive: isActive !== false,
      seo,
    });
    await writeAuditLog(req, 'CREATE', 'WebArticleCategory', String(created._id), `Tạo chuyên mục "${created.name}"`);
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.patch('/article-categories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await webArticleCategoryRepo.updateById(String(req.params.id), req.body || {});
    if (!updated) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Không tìm thấy chuyên mục');
    await writeAuditLog(req, 'UPDATE', 'WebArticleCategory', String(updated._id), `Cập nhật chuyên mục "${updated.name}"`);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.delete('/article-categories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ok = await webArticleCategoryRepo.deleteById(String(req.params.id));
    if (!ok) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Không tìm thấy chuyên mục');
    await writeAuditLog(req, 'DELETE', 'WebArticleCategory', String(req.params.id), `Xóa chuyên mục ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.get('/articles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = String(req.query.status || '').trim();
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const items = await webArticleRepo.find(filter, { createdAt: -1 });
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.post('/articles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, slug, excerpt, contentHtml, thumbnailUrl, categoryId, tags, relatedProductIds, status, seo } =
      req.body || {};
    if (!title || !slug) throw new ApiError(400, 'VALIDATION_ERROR', 'Tiêu đề và slug là bắt buộc');
    const st = status || 'DRAFT';
    const created = await webArticleRepo.create({
      title: String(title).trim(),
      slug: String(slug).trim().toLowerCase(),
      excerpt: String(excerpt || ''),
      contentHtml: String(contentHtml || ''),
      thumbnailUrl: String(thumbnailUrl || ''),
      categoryId: String(categoryId || ''),
      tags: Array.isArray(tags) ? tags : [],
      relatedProductIds: Array.isArray(relatedProductIds) ? relatedProductIds : [],
      status: st,
      publishedAt: st === 'PUBLISHED' ? new Date() : null,
      authorId: req.user?.userId || '',
      authorName: req.user?.fullName || '11 Sport',
      approvedBy: st === 'PUBLISHED' ? req.user?.userId || '' : '',
      seo,
      viewCount: 0,
    });
    invalidateWebCache('public:home');
    await writeAuditLog(req, st === 'PUBLISHED' ? 'PUBLISH' : 'CREATE', 'WebArticle', String(created._id), `Bài viết "${created.title}" (${st})`);
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.patch('/articles/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await webArticleRepo.findById(String(req.params.id));
    if (!existing) throw new ApiError(404, 'ARTICLE_NOT_FOUND', 'Không tìm thấy bài viết');
    const patch: Record<string, unknown> = { ...(req.body || {}) };
    if (patch.status === 'PUBLISHED' && !existing.publishedAt) {
      patch.publishedAt = new Date();
      patch.approvedBy = req.user?.userId || '';
    }
    const updated = await webArticleRepo.updateById(String(existing._id), patch);
    invalidateWebCache('public:home');
    await writeAuditLog(
      req,
      patch.status === 'PUBLISHED' ? 'PUBLISH' : 'UPDATE',
      'WebArticle',
      String(existing._id),
      `Cập nhật bài viết "${updated?.title || existing.title}"`
    );
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.delete('/articles/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ok = await webArticleRepo.deleteById(String(req.params.id));
    if (!ok) throw new ApiError(404, 'ARTICLE_NOT_FOUND', 'Không tìm thấy bài viết');
    invalidateWebCache('public:home');
    await writeAuditLog(req, 'DELETE', 'WebArticle', String(req.params.id), `Xóa bài viết ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.get('/pages', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await webStaticPageRepo.find({}, { updatedAt: -1 });
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.post('/pages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, slug, contentHtml, status, seo } = req.body || {};
    if (!title || !slug) throw new ApiError(400, 'VALIDATION_ERROR', 'Tiêu đề và slug là bắt buộc');
    const created = await webStaticPageRepo.create({
      title: String(title).trim(),
      slug: String(slug).trim().toLowerCase(),
      contentHtml: String(contentHtml || ''),
      status: status || 'DRAFT',
      seo,
      updatedBy: req.user?.userId || '',
    });
    await writeAuditLog(req, 'CREATE', 'WebStaticPage', String(created._id), `Tạo trang tĩnh "${created.title}"`);
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.patch('/pages/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await webStaticPageRepo.updateById(String(req.params.id), {
      ...(req.body || {}),
      updatedBy: req.user?.userId || '',
    });
    if (!updated) throw new ApiError(404, 'PAGE_NOT_FOUND', 'Không tìm thấy trang tĩnh');
    await writeAuditLog(req, 'UPDATE', 'WebStaticPage', String(updated._id), `Cập nhật trang tĩnh "${updated.title}"`);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.delete('/pages/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ok = await webStaticPageRepo.deleteById(String(req.params.id));
    if (!ok) throw new ApiError(404, 'PAGE_NOT_FOUND', 'Không tìm thấy trang tĩnh');
    await writeAuditLog(req, 'DELETE', 'WebStaticPage', String(req.params.id), `Xóa trang tĩnh ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ==================== 8. PROMOTIONS ONLINE & REVIEWS ====================

cmsWebRouter.get('/promotions', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const all = await promotionRepo.find({}, { createdAt: -1 });
    const online = all.filter((p: any) => Array.isArray(p.applyChannels) && p.applyChannels.includes('ONLINE'));
    res.json({ data: online });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.post('/promotions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body || {};
    if (!body.code || !body.name) throw new ApiError(400, 'VALIDATION_ERROR', 'Mã và tên khuyến mãi là bắt buộc');
    const created = await promotionRepo.create({
      ...body,
      code: String(body.code).trim().toUpperCase(),
      applyChannels: Array.isArray(body.applyChannels) && body.applyChannels.length > 0 ? body.applyChannels : ['ONLINE'],
      createdBy: req.user?.userId || '',
      createdByName: req.user?.fullName || '',
    });
    invalidateWebCache('public:home');
    await writeAuditLog(req, 'CREATE', 'PromotionOnline', String(created._id), `Tạo khuyến mãi Online "${created.name}"`);
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.patch('/promotions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await promotionRepo.updateById(String(req.params.id), req.body || {});
    if (!updated) throw new ApiError(404, 'PROMOTION_NOT_FOUND', 'Không tìm thấy khuyến mãi');
    invalidateWebCache('public:home');
    await writeAuditLog(req, 'UPDATE', 'PromotionOnline', String(updated._id), `Cập nhật khuyến mãi Online "${updated.name}"`);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.get('/reviews', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = String(req.query.status || '').trim();
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const items = await webReviewRepo.find(filter, { createdAt: -1 });
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.patch('/reviews/:id/moderate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, adminReply } = req.body || {};
    if (!['APPROVED', 'REJECTED'].includes(String(status))) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Trạng thái duyệt phải là APPROVED hoặc REJECTED');
    }
    const updated = await webReviewRepo.updateById(String(req.params.id), {
      status,
      ...(typeof adminReply === 'string' ? { adminReply: adminReply.trim() } : {}),
      moderatedBy: req.user?.userId || '',
      moderatedAt: new Date(),
    });
    if (!updated) throw new ApiError(404, 'REVIEW_NOT_FOUND', 'Không tìm thấy đánh giá');

    // Cập nhật ratingAvg & ratingCount trên Product
    const approved = await webReviewRepo.find({ productId: updated.productId, status: 'APPROVED' });
    const count = approved.length;
    const avg = count > 0 ? Number((approved.reduce((s, r) => s + r.rating, 0) / count).toFixed(1)) : 0;
    await productRepo.updateById(String(updated.productId), { ratingAvg: avg, ratingCount: count });

    await writeAuditLog(req, 'MODERATE', 'WebReview', String(updated._id), `Duyệt đánh giá -> ${status}`);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// ==================== 9. 301 REDIRECTS (GHI CHỈ ADMIN) ====================

cmsWebRouter.get('/redirects', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await webRedirectRepo.find({}, { createdAt: -1 });
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.post('/redirects', requireAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromPath, toPath, statusCode, isActive, note } = req.body || {};
    if (!fromPath || !toPath) throw new ApiError(400, 'VALIDATION_ERROR', 'fromPath và toPath là bắt buộc');
    const created = await webRedirectRepo.create({
      fromPath: String(fromPath).trim().toLowerCase(),
      toPath: String(toPath).trim(),
      statusCode: statusCode === 302 ? 302 : 301,
      isActive: isActive !== false,
      note: String(note || ''),
      createdBy: req.user?.userId || '',
    });
    await writeAuditLog(req, 'CREATE', 'WebRedirect', String(created._id), `${created.fromPath} -> ${created.toPath}`);
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.patch('/redirects/:id', requireAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await webRedirectRepo.updateById(String(req.params.id), req.body || {});
    if (!updated) throw new ApiError(404, 'REDIRECT_NOT_FOUND', 'Không tìm thấy redirect');
    await writeAuditLog(req, 'UPDATE', 'WebRedirect', String(updated._id), `Cập nhật redirect ${updated.fromPath}`);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.delete('/redirects/:id', requireAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ok = await webRedirectRepo.deleteById(String(req.params.id));
    if (!ok) throw new ApiError(404, 'REDIRECT_NOT_FOUND', 'Không tìm thấy redirect');
    await writeAuditLog(req, 'DELETE', 'WebRedirect', String(req.params.id), `Xóa redirect ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ==================== 10. SITE SETTINGS (CẤU HÌNH KỸ THUẬT CHỈ ADMIN) ====================

const TECHNICAL_SETTING_FIELDS = [
  'payosClientId',
  'payosApiKey',
  'payosChecksumKey',
  'cloudinaryCloudName',
  'cloudinaryApiKey',
  'cloudinaryApiSecret',
  'cloudinaryFolder',
  'webhookSecret',
  'onlineStockMode',
  'ga4Id',
  'gtmId',
  'revalidateSecret',
];

cmsWebRouter.post('/cloudinary/test-connection', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const siteSetting = await getOnlineSiteSetting().catch(() => null);
    const body = req.body || {};
    const cloudName = String(body.cloudName || siteSetting?.cloudinaryCloudName || process.env.CLOUDINARY_CLOUD_NAME || '').trim();
    const apiKey = String(body.apiKey || siteSetting?.cloudinaryApiKey || process.env.CLOUDINARY_API_KEY || '').trim();
    const apiSecret = String(body.apiSecret || siteSetting?.cloudinaryApiSecret || process.env.CLOUDINARY_API_SECRET || '').trim();
    const folder = String(body.folder || siteSetting?.cloudinaryFolder || process.env.CLOUDINARY_FOLDER || '11sport-web').trim() || '11sport-web';

    if (!cloudName || !apiKey || !apiSecret) {
      throw new ApiError(400, 'CLOUDINARY_MISSING_CONFIG', 'Vui lòng cung cấp đầy đủ Cloud Name, API Key và API Secret');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const testFolder = `${folder}/test-connection`;
    const signatureBase = `folder=${testFolder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(signatureBase).digest('hex');

    // 1x1 transparent GIF (43 bytes)
    const testPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    const form = new URLSearchParams();
    form.set('file', testPixel);
    form.set('api_key', apiKey);
    form.set('timestamp', String(timestamp));
    form.set('folder', testFolder);
    form.set('signature', signature);

    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    const uploadJson: any = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok || !uploadJson?.secure_url) {
      const msg = uploadJson?.error?.message || 'Không thể kết nối tới Cloudinary với thông tin đã cung cấp';
      throw new ApiError(400, 'CLOUDINARY_TEST_FAILED', msg);
    }

    res.json({
      success: true,
      data: {
        connected: true,
        cloudName,
        folder,
        testUrl: uploadJson.secure_url,
        message: 'Kết nối và xác thực tài khoản Cloudinary thành công!',
      },
    });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.get('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const setting = await getOnlineSiteSetting();
    const copy = { ...(setting as any) };
    if (req.user?.role !== 'ADMIN') {
      for (const secretField of ['payosApiKey', 'payosChecksumKey', 'cloudinaryApiSecret', 'webhookSecret', 'revalidateSecret']) {
        if (copy[secretField]) copy[secretField] = '********';
      }
    }
    res.json({ data: copy });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.put('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body || {};
    const touchesTechnical = TECHNICAL_SETTING_FIELDS.some((f) => body[f] !== undefined);
    if (touchesTechnical && req.user?.role !== 'ADMIN') {
      throw new ApiError(
        403,
        'TECHNICAL_SETTINGS_ADMIN_ONLY',
        'Chỉ ADMIN mới được phép sửa cấu hình kỹ thuật (Payment keys, kho online, GA4/GTM, Revalidate secret)'
      );
    }

    const existing = await webSiteSettingRepo.findOne({ key: 'DEFAULT' });
    let saved: any;
    if (existing) {
      saved = await webSiteSettingRepo.updateById(String(existing._id), {
        ...body,
        key: 'DEFAULT',
        updatedBy: req.user?.userId || '',
      });
    } else {
      saved = await webSiteSettingRepo.create({
        ...body,
        key: 'DEFAULT',
        updatedBy: req.user?.userId || '',
      });
    }

    invalidateWebCache();
    await writeAuditLog(req, 'UPDATE', 'WebSiteSetting', 'DEFAULT', 'Cập nhật cấu hình Website');
    res.json({ data: saved });
  } catch (err) {
    next(err);
  }
});

// ==================== 11. ONLINE ORDERS ====================

cmsWebRouter.get('/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fulfillmentStatus = String(req.query.fulfillmentStatus || '').trim();
    const paymentStatus = String(req.query.paymentStatus || '').trim();
    const q = String(req.query.q || '').trim().toLowerCase();

    const orders = await orderRepo.find({ channel: 'ONLINE' }, { createdAt: -1 });
    const filtered = orders.filter((o) => {
      if (fulfillmentStatus && o.fulfillmentStatus !== fulfillmentStatus) return false;
      if (paymentStatus && o.paymentStatus !== paymentStatus) return false;
      if (q && !`${o.orderCode} ${o.customerName} ${o.customerPhone}`.toLowerCase().includes(q)) return false;
      return true;
    });

    res.json({ data: filtered });
  } catch (err) {
    next(err);
  }
});

cmsWebRouter.patch('/orders/:id/fulfillment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await orderRepo.findById(String(req.params.id));
    if (!order || order.channel !== 'ONLINE') {
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng Online');
    }

    const { fulfillmentStatus, trackingCode } = req.body || {};
    const validStatuses = ['PENDING', 'CONFIRMED', 'PACKING', 'SHIPPING', 'DELIVERED', 'CANCELLED'];
    if (fulfillmentStatus && !validStatuses.includes(String(fulfillmentStatus))) {
      throw new ApiError(400, 'INVALID_STATUS', 'Trạng thái giao hàng không hợp lệ');
    }

    const patch: Record<string, unknown> = {};
    if (fulfillmentStatus) patch.fulfillmentStatus = fulfillmentStatus;
    if (typeof trackingCode === 'string') patch.trackingCode = trackingCode.trim();

    // Nếu hủy đơn chưa từng bị hủy -> hoàn trả tồn kho atomic
    if (fulfillmentStatus === 'CANCELLED' && order.fulfillmentStatus !== 'CANCELLED') {
      const restoreItems: { productId: string; variantKey?: string; quantity: number }[] = [];
      for (const it of order.items || []) {
        const prod = await productRepo.findById(String(it.productId));
        const matchedVariant = prod?.variants?.find(
          (v) => v.color === (it.color || '') && v.size === (it.size || '')
        );
        restoreItems.push({
          productId: String(it.productId),
          variantKey: matchedVariant?.variantKey || 'DEFAULT',
          quantity: Number(it.quantity || 0),
        });
      }
      await atomicRestoreOnlineStock(restoreItems);
      for (const it of order.items || []) {
        await stockMovementRepo.create({
          productId: String(it.productId),
          productCode: it.productCode || '',
          productName: it.productName || '',
          color: it.color || '',
          size: it.size || '',
          warehouseLocation: 'FLOOR_1',
          type: 'ADJUSTMENT',
          categoryId: '',
          unit: it.unit || 'Cái',
          quantityChange: Number(it.quantity || 0),
          balanceBefore: 0,
          balanceAfter: 0,
          referenceType: 'ADJUSTMENT',
          referenceId: String(order._id),
          referenceCode: order.orderCode,
          note: `Hoàn kho do hủy đơn Online ${order.orderCode}`,
          performedBy: req.user?.userId || '',
          performedByName: req.user?.fullName || '',
        });
      }
    }

    const updated = await orderRepo.updateById(String(order._id), patch);
    await writeAuditLog(
      req,
      'UPDATE_FULFILLMENT',
      'OrderOnline',
      String(order._id),
      `Đơn ${order.orderCode}: ${fulfillmentStatus || ''} ${trackingCode ? `(Tracking: ${trackingCode})` : ''}`
    );
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});
