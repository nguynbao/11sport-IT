import { handle } from '../shared/http';
import {
  listBrands,
  createBrand,
  updateBrand,
  deleteBrand,
} from '../services/catalog';

export const getBrandsHandler = handle((req) => listBrands(req.query));
export const postBrandsHandler = handle((req, ctx) => createBrand(ctx, req.body));
export const patchBrands_ByIdHandler = handle((req, ctx, ) =>
  updateBrand(ctx, req.params.id, req.body)
);
export const deleteBrands_ByIdHandler = handle((req, ctx) =>
  deleteBrand(ctx, req.params.id)
);
