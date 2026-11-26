import type { PosTabProps } from "../types";
import { usePosState } from "./usePosState";
import { usePosDrafts } from "./usePosDrafts";
import { usePosCatalog } from "./usePosCatalog";
import { usePosPromotions } from "./usePosPromotions";
import { usePosScanner } from "./usePosScanner";
import { usePosCart } from "./usePosCart";
import { usePosCheckout } from "./usePosCheckout";
import { usePosServerDrafts } from "./usePosServerDrafts";

/** Hook điều phối: ghép các hook con của POS. */
export function usePosTab({ onOpenInvoice }: PosTabProps) {
  const state = usePosState();
  const drafts = usePosDrafts({ ...state });
  const catalog = usePosCatalog({ ...state, ...drafts });
  const promotions = usePosPromotions({ ...state, ...drafts, ...catalog });
  const scanner = usePosScanner({ ...state, ...drafts, ...catalog, ...promotions });
  const cart = usePosCart({ ...state, ...drafts, ...catalog, ...promotions, ...scanner });
  const checkout = usePosCheckout({ ...state, ...drafts, ...catalog, ...promotions, ...scanner, ...cart }, onOpenInvoice);
  const serverdrafts = usePosServerDrafts({ ...state, ...drafts, ...catalog, ...promotions, ...scanner, ...cart, ...checkout }, onOpenInvoice);

  return { ...state, ...drafts, ...catalog, ...promotions, ...scanner, ...cart, ...checkout, ...serverdrafts };
}

export type PosCtx = ReturnType<typeof usePosTab>;
