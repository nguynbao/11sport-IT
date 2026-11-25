"use client";

import { AttendanceIpConfigModule, HrmAttendanceModule, MyAttendanceCalendar } from "@/features/attendance";
import { CategoryBrandModule } from "@/features/catalog";
import { InventoryModule } from "@/features/inventory";
import { DebtManagementModule, OrdersReturnsModule } from "@/features/orders";
import { PromotionModule } from "@/features/promotions";
import { MarketingPushProductsModule, RevenueDashboardModule, StaffActivityModule } from "@/features/reports";
import { ServiceManagementModule } from "@/features/services";
import { ShiftHandoverModule } from "@/features/shifts";
import { AccountProfileModule, StaffModule } from "@/features/staff";
import InvoicePdfModal from "@/shared/ui/InvoicePdfModal";
import React from "react";
import { CmsAuthGate } from "./_components/CmsAuthGate";
import { CmsChangePasswordModal } from "./_components/CmsChangePasswordModal";
import { CmsDrawers } from "./_components/CmsDrawers";
import { CmsHeader } from "./_components/CmsHeader";
import { useCmsShell } from "./_hooks/useCmsShell";

export default function CmsDashboardPage() {
  const {
    setActiveModule,
    isDrawerOpen,
    setIsDrawerOpen,
    isRightDrawerOpen,
    setIsRightDrawerOpen,
    adminUser,
    setAdminUser,
    checkingAuth,
    invoiceOrder,
    setInvoiceOrder,
    username,
    setUsername,
    password,
    setPassword,
    loginLoading,
    loginError,
    showChangePwdModal,
    setShowChangePwdModal,
    showIpConfigModal,
    setShowIpConfigModal,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmNewPassword,
    setConfirmNewPassword,
    pwdLoading,
    pwdMessage,
    setPwdMessage,
    handleLoginSubmit,
    handleLogout,
    handleOpenChangePwd,
    handleChangePasswordSubmit,
    userAllowedModules,
    defaultMainModule,
    visibleMenuItems,
    effectiveModule,
    currentMenu,
    CurrentIcon,
  } = useCmsShell();

  if (checkingAuth || !adminUser) {
    return (
      <CmsAuthGate
        checkingAuth={checkingAuth}
        adminUser={adminUser}
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        loginError={loginError}
        loginLoading={loginLoading}
        handleLoginSubmit={handleLoginSubmit}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <CmsHeader
        adminUser={adminUser}
        effectiveModule={effectiveModule}
        currentMenuDisplayLabel={currentMenu.displayLabel}
        CurrentIcon={CurrentIcon}
        onOpenLeftDrawer={() => setIsDrawerOpen(true)}
        onOpenRightDrawer={() => setIsRightDrawerOpen(true)}
        onOpenMyAttendance={() => setActiveModule("MY_ATTENDANCE")}
      />

      <CmsDrawers
        isRightDrawerOpen={isRightDrawerOpen}
        setIsRightDrawerOpen={setIsRightDrawerOpen}
        isDrawerOpen={isDrawerOpen}
        setIsDrawerOpen={setIsDrawerOpen}
        adminUser={adminUser}
        effectiveModule={effectiveModule}
        setActiveModule={setActiveModule}
        visibleMenuItems={visibleMenuItems}
        userAllowedModules={userAllowedModules}
        handleOpenChangePwd={handleOpenChangePwd}
        handleLogout={handleLogout}
        setShowIpConfigModal={setShowIpConfigModal}
      />

      {/* Main Content (Nới rộng tối đa không gian hiển thị 2 bên) */}
      <main className="flex-1 max-w-[98vw] 2xl:max-w-[1880px] w-full mx-auto px-3 sm:px-5 py-5 print:p-0">
        {effectiveModule === "INVENTORY" && <InventoryModule />}
        {effectiveModule === "REVENUE" && (
          <RevenueDashboardModule
            onNavigateToInventory={() => setActiveModule("INVENTORY")}
          />
        )}
        {effectiveModule === "CATEGORIES" && <CategoryBrandModule />}
        {effectiveModule === "ORDERS" && (
          <OrdersReturnsModule onOpenInvoice={(ord) => setInvoiceOrder(ord)} />
        )}
        {effectiveModule === "SERVICES" && (
          <ServiceManagementModule currentUser={adminUser} />
        )}
        {effectiveModule === "STAFF" && (
          <StaffModule
            mode={adminUser.role === "CEO" ? "HR_FULL" : "ADMIN_LOCK_ONLY"}
            currentUser={adminUser}
          />
        )}
        {effectiveModule === "HRM" && <HrmAttendanceModule currentUser={adminUser} />}
        {effectiveModule === "MY_ATTENDANCE" && (
          <MyAttendanceCalendar
            currentUser={adminUser}
            onBack={() => setActiveModule(defaultMainModule)}
          />
        )}
        {effectiveModule === "SHIFT_HANDOVERS" && (
          <ShiftHandoverModule currentUser={adminUser} />
        )}
        {effectiveModule === "ACTIVITY" && <StaffActivityModule />}
        {effectiveModule === "PROMOTIONS" && <PromotionModule />}
        {effectiveModule === "DEBTS" && (
          <DebtManagementModule onOpenInvoice={(ord) => setInvoiceOrder(ord)} />
        )}
        {effectiveModule === "PUSH_PRODUCTS" && <MarketingPushProductsModule />}
        {effectiveModule === "PROFILE" && (
          <AccountProfileModule
            currentUser={adminUser}
            onUserUpdated={(updated) => setAdminUser(updated)}
            onBack={() => setActiveModule(defaultMainModule)}
          />
        )}
      </main>

      <CmsChangePasswordModal
        adminUser={adminUser}
        showChangePwdModal={showChangePwdModal}
        setShowChangePwdModal={setShowChangePwdModal}
        currentPassword={currentPassword}
        setCurrentPassword={setCurrentPassword}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmNewPassword={confirmNewPassword}
        setConfirmNewPassword={setConfirmNewPassword}
        pwdMessage={pwdMessage}
        pwdLoading={pwdLoading}
        handleChangePasswordSubmit={handleChangePasswordSubmit}
      />

      {/* Modal In Hóa Đơn PDF (K80 / A4) */}
      <InvoicePdfModal
        order={invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
      />

      {/* Modal Cấu Hình IP Wi-Fi Chấm Công (2 Cơ Sở) */}
      {showIpConfigModal && (
        <AttendanceIpConfigModule
          currentUser={adminUser}
          isModal
          onClose={() => setShowIpConfigModal(false)}
        />
      )}
    </div>
  );
}

