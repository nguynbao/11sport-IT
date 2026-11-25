import { handle } from '../shared/http';
import {
  parseImportFile,
  ocrPreview,
  ocrScan,
  listImports,
  getImportById,
  createImport,
  updateImport,
  finishImportListing,
  deleteImport,
  scanCheck,
  scanTag,
  completeImport,
} from '../services/imports';

export const postImportsParseFileHandler = handle((req) => parseImportFile(req.body));
export const postImportsOcrPreviewHandler = handle((req) => ocrPreview(req.body));
export const postImportsOcrScanHandler = handle((req) => ocrScan(req.body));
export const getImportsHandler = handle((req) => listImports(req.query));
export const getImports_ByIdHandler = handle((req) => getImportById(req.params.id));
export const postImportsHandler = handle((req, ctx) => createImport(ctx, req.body));
export const putImports_ByIdHandler = handle((req, ctx) =>
  updateImport(ctx, req.params.id, req.body)
);
export const postImports_ByIdFinishListingHandler = handle((req, ctx) =>
  finishImportListing(ctx, req.params.id, req.body)
);
export const deleteImports_ByIdHandler = handle((req, ctx) =>
  deleteImport(ctx, req.params.id)
);
export const postImports_ByIdScanCheckHandler = handle((req, ctx) =>
  scanCheck(ctx, req.params.id, req.body)
);
export const postImports_ByIdScanTagHandler = handle((req, ctx) =>
  scanTag(ctx, req.params.id, req.body)
);
export const postImports_ByIdCompleteHandler = handle((req, ctx) =>
  completeImport(ctx, req.params.id, req.body)
);
