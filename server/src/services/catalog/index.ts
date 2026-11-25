export {
  ensureCategorySkuCode,
  ensureSystemBrand,
} from './catalogDefaults.service';

export type { ImportSchemeContext } from './productScheme.service';

export {
  resolveCategoryAndBrand,
  resolveVersionCode,
  buildSchemeRootCode,
  prepareSchemeVariants,
  findCodeConflicts,
  findCodeConflictsInList,
  findDuplicateProduct,
  syncProductReferencesAfterRecode,
  loadImportSchemeContext,
  findExistingProductForImport,
  proposeImportProduct,
  resolveImportColorCode,
  resolveExplicitImportSchemeItem,
  createProductFromImportProposal,
} from './productScheme.service';

export {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from './category.service';

export {
  countProductsByBrand,
  listBrands,
  createBrand,
  updateBrand,
  deleteBrand,
} from './brand.service';

export {
  assertLocalMongoUri,
  buildRecodePlan,
  writeReviewCsv,
  readReviewFile,
  backupDatabase,
  applyRecode,
  runRecodeCli,
} from './recode.service';
