import { handle } from '../shared/http';
import { login, changePassword } from '../services/auth';
import {
  listStaff,
  parseStaffImport,
  createStaff,
  updateStaff,
} from '../services/staff';

export const postAuthLoginHandler = handle((req) => login(req.body));

export const postAuthChangePasswordHandler = handle((req, ctx) =>
  changePassword(ctx, req.body)
);

export const getStaffHandler = handle((req, ctx) =>
  listStaff(ctx, req.query)
);

export const postStaffParseImportFileHandler = handle((req, ctx) =>
  parseStaffImport(ctx, req.body)
);

export const postStaffHandler = handle((req, ctx) =>
  createStaff(ctx, req.body)
);

export const patchStaff_ByIdHandler = handle((req, ctx) =>
  updateStaff(ctx, req.params.id, req.body)
);
