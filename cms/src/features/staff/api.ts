import { apiRequest } from "@/shared/api/client";
import type { ParsedStaffImportRow } from "@/shared/types";

export async function parseStaffImportFileApi(params: {
  fileName: string;
  fileBase64?: string;
  csvText?: string;
}): Promise<ParsedStaffImportRow[]> {
  const res = await apiRequest<{ rows: ParsedStaffImportRow[] }>("/staff/parse-import-file", {
    method: "POST",
    body: JSON.stringify(params),
  });
  return res.data?.rows || [];
}

