"use client";

import ContractFilePreviewModal from "@/shared/ui/ContractFilePreviewModal";
import {
AlertCircle,
CheckCircle2
} from "lucide-react";
import { StaffModuleProps,useStaffModule } from "../hooks/useStaffModule";
import { StaffCreateForm } from "./StaffCreateForm";
import { StaffEditProfileModal } from "./StaffEditProfileModal";
import { StaffImportPreviewModal } from "./StaffImportPreviewModal";
import { StaffListTable } from "./StaffListTable";
import { StaffPasswordModal } from "./StaffPasswordModal";

export default function StaffModule(props: StaffModuleProps) {
  const vm = useStaffModule(props);
  const {
    fullName,
    previewContractStaff,
    setPreviewContractStaff,
    statusMsg,
  } = vm;

  return (
    <div className="space-y-6">
      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            statusMsg.type === "success"
              ? "bg-teal-50 border-teal-200 text-brand-ink"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {statusMsg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <StaffCreateForm vm={vm} />
      <StaffListTable vm={vm} />
      <StaffImportPreviewModal vm={vm} />
      <StaffPasswordModal vm={vm} />
      <StaffEditProfileModal vm={vm} />
      {/* Modal Xem Trước / Tải Xuống File Hợp Đồng (Hỗ trợ PDF, DOCX, DOC, Ảnh) */}
      {previewContractStaff && (
        <ContractFilePreviewModal
          staffName={previewContractStaff.fullName}
          fileName={previewContractStaff.fileName}
          fileUrl={previewContractStaff.fileUrl}
          onClose={() => setPreviewContractStaff(null)}
        />
      )}
    </div>
  );
}
