import type { ShiftHandoverRecord, StaffUser } from "@/shared/types";

export interface ShiftHandoverModalProps {
  currentUser: StaffUser | null;
  shiftCode?: "SHIFT_1" | "SHIFT_2" | "BOTH";
  existingHandover?: ShiftHandoverRecord | null;
  canConfirmCheckout?: boolean;
  shiftEndLabel?: string;
  initialMode?: "DRAFT" | "CHECKOUT";
  onClose: () => void;
  onSavedDraft?: (handover: ShiftHandoverRecord) => void;
  onSuccess: (handover?: ShiftHandoverRecord, lateCheckoutReason?: string) => void;
}
