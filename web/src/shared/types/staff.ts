export type UserRole = "CEO" | "ADMIN" | "ACCOUNTANT" | "HR" | "MARKETING" | "SALES";
export type Department = "OFFICE" | "SALES";
/** INTERN = Thực tập, PROBATION = Thử việc, FULLTIME = Chính thức (PARTTIME: giá trị cũ) */
export type ContractType = "INTERN" | "PROBATION" | "FULLTIME" | "PARTTIME";

export interface StaffUser {
  _id: string;
  code: string;
  username: string;
  fullName: string;
  phone?: string;
  email?: string;
  companyEmail?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  citizenId?: string;
  citizenIssueDate?: string;
  citizenIssuePlace?: string;
  address?: string;
  permanentAddress?: string;
  currentAddress?: string;
  school?: string;
  major?: string;
  positionTitle?: string;
  bankAccount?: string;
  role: UserRole;
  department?: Department;
  contractType?: ContractType;
  probationStartDate?: string;
  probationMonths?: number;
  fulltimeStartDate?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  internContractNumber?: string;
  probationContractNumber?: string;
  officialContractNumber?: string;
  contractFileUrl?: string;
  contractFileName?: string;
  bhxhStartDate?: string;
  bhxhEndDate?: string;
  recordedLeaveDays?: number;
  baseSalary?: number;
  allowance?: number;
  bonus?: number;
  insurance?: number;
  status: "ACTIVE" | "LOCKED";
}
