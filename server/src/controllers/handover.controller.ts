import { handle } from '../shared/http';
import {
  getHandoverScheduleConfig,
  updateHandoverScheduleConfig,
  getDailyHandoverCheck,
  listHandovers,
  submitHandover,
  confirmHandover,
  deleteHandover,
} from '../services/handover';

export const getHandoverScheduleConfigHandler = handle((_req, ctx) =>
  getHandoverScheduleConfig(ctx)
);

export const putHandoverScheduleConfigHandler = handle((req, ctx) =>
  updateHandoverScheduleConfig(ctx, req.body)
);

export const getHandoverDailyCheckHandler = handle((req, ctx) =>
  getDailyHandoverCheck(ctx, req.query)
);

export const listHandoversHandler = handle((req, ctx) =>
  listHandovers(ctx, req.query)
);

export const submitHandoverHandler = handle((req, ctx) =>
  submitHandover(ctx, req.body)
);

export const confirmHandoverHandler = handle((req, ctx) =>
  confirmHandover(ctx, req.params.id, req.body)
);

export const deleteHandoverHandler = handle((req, ctx) =>
  deleteHandover(ctx, req.params.id)
);
