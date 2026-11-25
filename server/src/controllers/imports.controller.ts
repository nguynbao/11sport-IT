import { Request, Response, NextFunction } from 'express';
import {
  postImportsParseFile,
  postImportsOcrPreview,
  postImportsOcrScan,
  getImports,
  getImports_ById,
  postImports,
  putImports_ById,
  postImports_ByIdFinishListing,
  deleteImports_ById,
  postImports_ByIdScanCheck,
  postImports_ByIdScanTag,
  postImports_ByIdComplete,
} from '../services/imports.service';

export async function postImportsParseFileHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postImportsParseFile({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postImportsOcrPreviewHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postImportsOcrPreview({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postImportsOcrScanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postImportsOcrScan({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function getImportsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getImports({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function getImports_ByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getImports_ById({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postImportsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postImports({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function putImports_ByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await putImports_ById({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postImports_ByIdFinishListingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postImports_ByIdFinishListing({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function deleteImports_ByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await deleteImports_ById({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postImports_ByIdScanCheckHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postImports_ByIdScanCheck({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postImports_ByIdScanTagHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postImports_ByIdScanTag({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    if (result.headers) {
      for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
    }
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postImports_ByIdCompleteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postImports_ByIdComplete({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}
