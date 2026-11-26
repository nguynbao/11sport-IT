import React, { useState, useEffect } from "react";
import type { StaffUser } from "@/shared/types";
import { apiRequest, getStoredToken, setStoredAuth } from "@/shared/api/client";
import { cleanPhoneDigits } from "@/shared/utils/format";
import { toIsoDateSlice } from "../utils/accountProfile";

interface UseAccountProfileArgs {
  currentUser: StaffUser;
  onUserUpdated: (updated: StaffUser) => void;
}

export function useAccountProfile({ currentUser, onUserUpdated }: UseAccountProfileArgs) {
  // Các trường nhân viên được phép tự cập nhật
  const [fullName, setFullName] = useState(currentUser.fullName || "");
  const [phone, setPhone] = useState(currentUser.phone || "");
  const [email, setEmail] = useState(currentUser.email || "");
  const [companyEmail, setCompanyEmail] = useState(currentUser.companyEmail || "");
  const [dateOfBirth, setDateOfBirth] = useState(toIsoDateSlice(currentUser.dateOfBirth));
  const [gender, setGender] = useState(currentUser.gender || "");
  const [nationality, setNationality] = useState(currentUser.nationality || "Việt Nam");
  const [citizenId, setCitizenId] = useState(currentUser.citizenId || "");
  const [citizenIssueDate, setCitizenIssueDate] = useState(
    toIsoDateSlice(currentUser.citizenIssueDate)
  );
  const [citizenIssuePlace, setCitizenIssuePlace] = useState(
    currentUser.citizenIssuePlace || ""
  );
  const [permanentAddress, setPermanentAddress] = useState(
    currentUser.permanentAddress || currentUser.address || ""
  );
  const [currentAddress, setCurrentAddress] = useState(
    currentUser.currentAddress || ""
  );
  const [school, setSchool] = useState(currentUser.school || "");
  const [major, setMajor] = useState(currentUser.major || "");
  const [bankAccount, setBankAccount] = useState(currentUser.bankAccount || "");

  // Các trường chỉ xem (do HR quản lý)
  const [positionTitle, setPositionTitle] = useState(currentUser.positionTitle || "");
  const [department, setDepartment] = useState(
    currentUser.department || (currentUser.role === "SALES" ? "SALES" : "OFFICE")
  );
  const [contractType, setContractType] = useState(currentUser.contractType || "");
  const [contractStartDate, setContractStartDate] = useState(
    toIsoDateSlice(currentUser.contractStartDate)
  );
  const [contractEndDate, setContractEndDate] = useState(
    toIsoDateSlice(currentUser.contractEndDate)
  );
  const [internContractNumber, setInternContractNumber] = useState(
    currentUser.internContractNumber || ""
  );
  const [probationContractNumber, setProbationContractNumber] = useState(
    currentUser.probationContractNumber || ""
  );
  const [officialContractNumber, setOfficialContractNumber] = useState(
    currentUser.officialContractNumber || ""
  );
  const [bhxhStartDate, setBhxhStartDate] = useState(
    toIsoDateSlice(currentUser.bhxhStartDate)
  );
  const [bhxhEndDate, setBhxhEndDate] = useState(
    toIsoDateSlice(currentUser.bhxhEndDate)
  );
  const [recordedLeaveDays, setRecordedLeaveDays] = useState<number>(
    Number(currentUser.recordedLeaveDays || 0)
  );
  const [contractFileUrl, setContractFileUrl] = useState(
    currentUser.contractFileUrl || ""
  );
  const [contractFileName, setContractFileName] = useState(
    currentUser.contractFileName || ""
  );
  const [baseSalary, setBaseSalary] = useState<number>(
    Number(currentUser.baseSalary || 0)
  );
  const [allowance, setAllowance] = useState<number>(
    Number(currentUser.allowance || 0)
  );
  const [bonus, setBonus] = useState<number>(Number(currentUser.bonus || 0));
  const [insurance, setInsurance] = useState<number>(
    Number(currentUser.insurance || 0)
  );

  const [showContractPreview, setShowContractPreview] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Đồng bộ lại thông tin mới nhất từ server khi mở trang
  useEffect(() => {
    let mounted = true;
    apiRequest<StaffUser[]>("/staff")
      .then((res) => {
        if (!mounted || !Array.isArray(res.data)) return;
        const found = res.data.find(
          (s) =>
            s._id === currentUser._id ||
            s.username?.toLowerCase() === currentUser.username?.toLowerCase()
        );
        if (found) {
          setFullName(found.fullName || "");
          setPhone(found.phone || "");
          setEmail(found.email || "");
          setCompanyEmail(found.companyEmail || "");
          setDateOfBirth(toIsoDateSlice(found.dateOfBirth));
          setGender(found.gender || "");
          setNationality(found.nationality || "Việt Nam");
          setCitizenId(found.citizenId || "");
          setCitizenIssueDate(toIsoDateSlice(found.citizenIssueDate));
          setCitizenIssuePlace(found.citizenIssuePlace || "");
          setPermanentAddress(found.permanentAddress || found.address || "");
          setCurrentAddress(found.currentAddress || "");
          setSchool(found.school || "");
          setMajor(found.major || "");
          setBankAccount(found.bankAccount || "");

          setPositionTitle(found.positionTitle || "");
          setDepartment(
            found.department || (found.role === "SALES" ? "SALES" : "OFFICE")
          );
          setContractType(found.contractType || "");
          setContractStartDate(toIsoDateSlice(found.contractStartDate));
          setContractEndDate(toIsoDateSlice(found.contractEndDate));
          setInternContractNumber(found.internContractNumber || "");
          setProbationContractNumber(found.probationContractNumber || "");
          setOfficialContractNumber(found.officialContractNumber || "");
          setBhxhStartDate(toIsoDateSlice(found.bhxhStartDate));
          setBhxhEndDate(toIsoDateSlice(found.bhxhEndDate));
          setRecordedLeaveDays(Number(found.recordedLeaveDays || 0));
          setContractFileUrl(found.contractFileUrl || "");
          setContractFileName(found.contractFileName || "");
          setBaseSalary(Number(found.baseSalary || 0));
          setAllowance(Number(found.allowance || 0));
          setBonus(Number(found.bonus || 0));
          setInsurance(Number(found.insurance || 0));

          const merged: StaffUser = {
            ...currentUser,
            ...found,
          };
          const token = getStoredToken();
          if (token) setStoredAuth(token, merged);
          onUserUpdated(merged);
        }
      })
      .catch(() => {
        // Giữ thông tin từ phiên hiện tại nếu offline/lỗi mạng
      });
    return () => {
      mounted = false;
    };
  }, [currentUser._id]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);

    const cleanName = fullName.trim();
    const cleanPhone = cleanPhoneDigits(phone);
    const cleanEmail = email.trim();
    const cleanCompanyEmail = companyEmail.trim();
    const cleanCitizenId = citizenId.trim();
    const cleanPerm = permanentAddress.trim();
    const cleanCurr = currentAddress.trim();

    if (!cleanName) {
      setProfileMsg({
        type: "error",
        text: "Họ và tên không được để trống.",
      });
      return;
    }

    setSavingProfile(true);
    try {
      const res = await apiRequest<StaffUser>(`/staff/${currentUser._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: cleanName,
          phone: cleanPhone,
          email: cleanEmail,
          companyEmail: cleanCompanyEmail,
          dateOfBirth: dateOfBirth || null,
          gender: gender.trim(),
          nationality: nationality.trim(),
          citizenId: cleanCitizenId,
          citizenIssueDate: citizenIssueDate || null,
          citizenIssuePlace: citizenIssuePlace.trim(),
          permanentAddress: cleanPerm,
          currentAddress: cleanCurr,
          address: cleanPerm || cleanCurr,
          school: school.trim(),
          major: major.trim(),
          bankAccount: bankAccount.trim(),
        }),
      });

      const updatedUser: StaffUser = {
        ...currentUser,
        ...(res.data || {}),
        fullName: res.data?.fullName || cleanName,
        phone: res.data?.phone !== undefined ? res.data.phone : cleanPhone,
        email: res.data?.email !== undefined ? res.data.email : cleanEmail,
        companyEmail:
          res.data?.companyEmail !== undefined
            ? res.data.companyEmail
            : cleanCompanyEmail,
        citizenId:
          res.data?.citizenId !== undefined ? res.data.citizenId : cleanCitizenId,
        permanentAddress:
          res.data?.permanentAddress !== undefined
            ? res.data.permanentAddress
            : cleanPerm,
        currentAddress:
          res.data?.currentAddress !== undefined
            ? res.data.currentAddress
            : cleanCurr,
        address:
          res.data?.address !== undefined
            ? res.data.address
            : cleanPerm || cleanCurr,
      };

      const token = getStoredToken();
      if (token) {
        setStoredAuth(token, updatedUser);
      }
      onUserUpdated(updatedUser);

      setProfileMsg({
        type: "success",
        text: "Đã cập nhật hồ sơ cá nhân thành công!",
      });
    } catch (err: any) {
      setProfileMsg({
        type: "error",
        text:
          err?.message ||
          "Không thể cập nhật thông tin cá nhân. Vui lòng thử lại.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  return {
    fullName,
    setFullName,
    phone,
    setPhone,
    email,
    setEmail,
    companyEmail,
    setCompanyEmail,
    dateOfBirth,
    setDateOfBirth,
    gender,
    setGender,
    nationality,
    setNationality,
    citizenId,
    setCitizenId,
    citizenIssueDate,
    setCitizenIssueDate,
    citizenIssuePlace,
    setCitizenIssuePlace,
    permanentAddress,
    setPermanentAddress,
    currentAddress,
    setCurrentAddress,
    school,
    setSchool,
    major,
    setMajor,
    bankAccount,
    setBankAccount,
    positionTitle,
    setPositionTitle,
    department,
    setDepartment,
    contractType,
    setContractType,
    contractStartDate,
    setContractStartDate,
    contractEndDate,
    setContractEndDate,
    internContractNumber,
    setInternContractNumber,
    probationContractNumber,
    setProbationContractNumber,
    officialContractNumber,
    setOfficialContractNumber,
    bhxhStartDate,
    setBhxhStartDate,
    bhxhEndDate,
    setBhxhEndDate,
    recordedLeaveDays,
    setRecordedLeaveDays,
    contractFileUrl,
    setContractFileUrl,
    contractFileName,
    setContractFileName,
    baseSalary,
    setBaseSalary,
    allowance,
    setAllowance,
    bonus,
    setBonus,
    insurance,
    setInsurance,
    showContractPreview,
    setShowContractPreview,
    savingProfile,
    setSavingProfile,
    profileMsg,
    setProfileMsg,
    handleSaveProfile,
  };
}

export type AccountProfileState = ReturnType<typeof useAccountProfile>;
