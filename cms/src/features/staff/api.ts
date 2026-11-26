import { apiRequest } from "@/shared/api/client";
import type { ParsedStaffImportRow } from "@/shared/types";
import { API_ENDPOINTS } from "@/shared/api/endpoints";

export async function parseStaffImportFileApi(params: {
  fileName: string;
  fileBase64?: string;
  csvText?: string;
}): Promise<ParsedStaffImportRow[]> {
  const res = await apiRequest<{ rows: ParsedStaffImportRow[] }>(API_ENDPOINTS.STAFF.PARSE_IMPORT_FILE, {
    method: "POST",
    body: JSON.stringify(params),
  });
  return res.data?.rows || [];
}

