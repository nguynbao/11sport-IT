import { Router } from 'express';
import { requireRoles } from '../middleware/auth';
import {
  postImportsParseFileHandler,
  postImportsOcrPreviewHandler,
  postImportsOcrScanHandler,
  getImportsHandler,
  getImports_ByIdHandler,
  postImportsHandler,
  putImports_ByIdHandler,
  postImports_ByIdFinishListingHandler,
  deleteImports_ByIdHandler,
  postImports_ByIdScanCheckHandler,
  postImports_ByIdScanTagHandler,
  postImports_ByIdCompleteHandler,
} from '../controllers/imports.controller';

export const importsRouter = Router();

importsRouter.use(
  '/imports',
  requireRoles(
    ['CEO', 'ADMIN', 'ACCOUNTANT'],
    'Chỉ Giám đốc (CEO), Quản trị viên hoặc Kế toán mới có quyền quản lý nhập kho'
  )
);

importsRouter.post('/imports/parse-file', postImportsParseFileHandler);
importsRouter.post('/imports/ocr-preview', postImportsOcrPreviewHandler);
importsRouter.post('/imports/ocr-scan', postImportsOcrScanHandler);
importsRouter.get('/imports', getImportsHandler);
importsRouter.get('/imports/:id', getImports_ByIdHandler);
importsRouter.post('/imports', postImportsHandler);
importsRouter.put('/imports/:id', putImports_ByIdHandler);
importsRouter.post('/imports/:id/finish-listing', postImports_ByIdFinishListingHandler);
importsRouter.delete('/imports/:id', deleteImports_ByIdHandler);
importsRouter.post('/imports/:id/scan-check', postImports_ByIdScanCheckHandler);
importsRouter.post('/imports/:id/scan-tag', postImports_ByIdScanTagHandler);
importsRouter.post('/imports/:id/complete', postImports_ByIdCompleteHandler);
