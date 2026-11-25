export interface ServiceRequest {
  user?: any;
  isFallbackUser?: boolean;
  query?: any;
  params?: any;
  body?: any;
  headers?: Record<string, any>;
  ip?: string;
  socket?: any;
}

export interface ServiceResponse<T = any> {
  status: number;
  payload: T;
}
