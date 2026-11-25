import { handle } from '../shared/http';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../services/catalog';

export const getCategoriesHandler = handle((req) => listCategories(req.query));
export const postCategoriesHandler = handle((req, ctx) => createCategory(ctx, req.body));
export const patchCategories_ByIdHandler = handle((req, ctx) =>
  updateCategory(ctx, req.params.id, req.body)
);
export const deleteCategories_ByIdHandler = handle((req, ctx) =>
  deleteCategory(ctx, req.params.id)
);
