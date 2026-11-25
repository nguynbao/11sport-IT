import { returnExchangeRepo } from "../../repositories";

export async function generateNextReturnExchangeCode(isExchange: boolean): Promise<string> {
  const all = await returnExchangeRepo.find({});
  let maxNum = all.length;
  for (const r of all) {
    const m = /^(?:TH|DH)-(\d+)$/i.exec(String(r.code || ''));
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  return `${isExchange ? 'DH' : 'TH'}-${String(maxNum + 1).padStart(4, '0')}`;
}

