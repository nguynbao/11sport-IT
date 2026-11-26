"use client";

import React from "react";
import type { StaffUser, UserRole } from "@/shared/types";
import ContractFilePreviewModal from "@/shared/ui/ContractFilePreviewModal";
import { useAccountProfile } from "../hooks/useAccountProfile";
import AccountHero from "./AccountHero";
import AccountPersonalForm from "./AccountPersonalForm";
import AccountHrSection from "./AccountHrSection";
import AccountRulesCard from "./AccountRulesCard";

interface AccountProfileTabProps {
  currentUser: StaffUser;
  onUserUpdated: (updated: StaffUser) => void;
  onBack: () => void;
  getRoleDisplayName: (role?: UserRole) => string;
}

export default function AccountProfileTab({
  currentUser,
  onUserUpdated,
  onBack,
  getRoleDisplayName,
}: AccountProfileTabProps) {
  const p = useAccountProfile({ currentUser, onUserUpdated });
  const {
    fullName,
    contractFileUrl,
    contractFileName,
    showContractPreview,
    setShowContractPreview,
  } = p;

  return (
    <div className="w-full space-y-5">
      <AccountHero
        p={p}
        currentUser={currentUser}
        onBack={onBack}
        getRoleDisplayName={getRoleDisplayName}
      />

      <div className="w-full space-y-5">
        <AccountPersonalForm p={p} />
        <AccountHrSection
          p={p}
          currentUser={currentUser}
          getRoleDisplayName={getRoleDisplayName}
        />
        <AccountRulesCard p={p} />
      </div>

      {/* Modal Xem trước / Tải về File Hợp đồng */}
      {showContractPreview && contractFileUrl && (
        <ContractFilePreviewModal
          staffName={fullName || currentUser.fullName}
          fileName={contractFileName || "Hop-dong-lao-dong"}
          fileUrl={contractFileUrl}
          onClose={() => setShowContractPreview(false)}
        />
      )}
    </div>
  );
}
