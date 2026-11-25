import { Router } from 'express';
import {
  getCategoriesHandler,
  postCategoriesHandler,
  patchCategories_ByIdHandler,
  deleteCategories_ByIdHandler,
} from '../controllers/categories.controller';

export const categoriesRouter = Router();

categoriesRouter.get('/categories', getCategoriesHandler);
categoriesRouter.post('/categories', postCategoriesHandler);
categoriesRouter.patch('/categories/:id', patchCategories_ByIdHandler);
categoriesRouter.delete('/categories/:id', deleteCategories_ByIdHandler);
