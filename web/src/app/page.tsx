"use client";

import React from "react";
import { Lock } from "lucide-react";
import { PosTab, PosShiftBillsSection, WiseCalculatorStash } from "@/features/pos";
import { PosServiceSection } from "@/features/services";
import { InventoryTab } from "@/features/inventory";
import { CustomerTab } from "@/features/customers";
import { ReturnExchangeTab } from "@/features/returns";
import { MarketingPushProductsTab } from "@/features/marketing";
import { MyAttendanceCalendar } from "@/features/attendance";
import { AccountProfileTab } from "@/features/account";
import InvoicePdfModal from "@/shared/ui/InvoicePdfModal";
import { MobileRowDetailModal } from "@/shared/ui/MobileRowDetailModal";
import { PullToRefreshIndicator } from "@/shared/ui/PullToRefreshIndicator";
import { useMobileTableLabels } from "@/shared/hooks/useMobileTableLabels";
import { usePullToRefresh } from "@/shared/hooks/usePullToRefresh";
import { getRoleDisplayName, isAttendanceOnlyRole } from "@/config/roles";
import { useWebShell } from "./_hooks/useWebShell";
import WebAuthGate from "./_components/WebAuthGate";
import WebHeader from "./_components/WebHeader";
import WebBottomNavbar from "./_components/WebBottomNavbar";
import WebDrawers from "./_components/WebDrawers";
import WebChangePasswordModal from "./_components/WebChangePasswordModal";

export default function WebPosHomePage() {
  useMobileTableLabels();
  const pullToRefresh = usePullToRefresh();
  const shell = useWebShell();

  if (shell.checkingAuth || !shell.currentUser) {
    return (
      <WebAuthGate
        checkingAuth={shell.checkingAuth}
        username={shell.username}
        onUsernameChange={shell.setUsername}
        password={shell.password}
        onPasswordChange={shell.setPassword}
        loginLoading={shell.loginLoading}
        loginError={shell.loginError}
        onLoginSubmit={shell.handleLoginSubmit}
      />
    );
  }

  const { currentUser } = shell;

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden flex flex-col bg-slate-100">
      <PullToRefreshIndicator
        pullDistance={pullToRefresh.pullDistance}
        isRefreshing={pullToRefresh.isRefreshing}
        isReadyToRefresh={pullToRefresh.isReadyToRefresh}
      />
      <WebHeader
        currentUser={currentUser}
        activeDrawerPage={shell.activeDrawerPage}
        currentTabConfig={shell.currentTabConfig}
        hasUnseenShiftSchedule={shell.hasUnseenShiftSchedule}
        onOpenLeftDrawer={() => shell.setLeftDrawerOpen(true)}
        onOpenRightDrawer={() => shell.setRightDrawerOpen(true)}
      />

      <main className="flex-1 w-full min-w-0 mx-auto px-2 py-2.5 pb-20 sm:px-3 lg:px-4 md:py-4 md:pb-4 print:p-0">
        {shell.activeDrawerPage === "PROFILE" ? (
          <AccountProfileTab
            currentUser={currentUser}
            onUserUpdated={(updated) => shell.setCurrentUser(updated)}
            onBack={() =>
              shell.setActiveDrawerPage(
                isAttendanceOnlyRole(currentUser.role) ? "ATTENDANCE" : "NONE"
              )
            }
            getRoleDisplayName={getRoleDisplayName}
          />
        ) : shell.activeDrawerPage === "ATTENDANCE" ||
          isAttendanceOnlyRole(currentUser.role) ? (
          <MyAttendanceCalendar
            currentUser={currentUser}
            onScheduleSeen={() => shell.setHasUnseenShiftSchedule(false)}
            onBack={
              isAttendanceOnlyRole(currentUser.role)
                ? undefined
                : () => shell.setActiveDrawerPage("NONE")
            }
          />
        ) : !shell.isCurrentTabAllowed ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-2">
            <Lock className="w-10 h-10 text-amber-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">
              Bạn không có quyền truy cập chức năng này
            </h3>
            <p className="text-xs text-slate-500">
              Vai trò hiện tại của bạn là{" "}
              <strong>{getRoleDisplayName(currentUser.role)}</strong>. Vui lòng chọn
              các tab được cấp quyền trên thanh công cụ.
            </p>
          </div>
        ) : (
          <>
            {shell.activeTab === "POS" && (
              <PosTab onOpenInvoice={(ord) => shell.setInvoiceOrder(ord)} />
            )}
            {shell.activeTab === "SERVICES" && <PosServiceSection />}
            {shell.activeTab === "INVENTORY" && <InventoryTab />}
            {shell.activeTab === "CUSTOMER" && (
              <CustomerTab onOpenInvoice={(ord) => shell.setInvoiceOrder(ord)} />
            )}
            {shell.activeTab === "RETURN" && <ReturnExchangeTab />}
            {shell.activeTab === "INVOICE_HISTORY" && (
              <PosShiftBillsSection onOpenInvoice={(ord) => shell.setInvoiceOrder(ord)} />
            )}
            {shell.activeTab === "PUSH_PRODUCTS" && <MarketingPushProductsTab />}
          </>
        )}
      </main>

      <WebDrawers
        currentUser={currentUser}
        activeTab={shell.activeTab}
        activeDrawerPage={shell.activeDrawerPage}
        leftDrawerOpen={shell.leftDrawerOpen}
        rightDrawerOpen={shell.rightDrawerOpen}
        hasUnseenShiftSchedule={shell.hasUnseenShiftSchedule}
        onCloseLeftDrawer={() => shell.setLeftDrawerOpen(false)}
        onCloseRightDrawer={() => shell.setRightDrawerOpen(false)}
        onSelectTab={(tabId) => {
          shell.setActiveDrawerPage("NONE");
          shell.setActiveTab(tabId);
        }}
        onOpenProfile={() => shell.setActiveDrawerPage("PROFILE")}
        onOpenAttendance={() => {
          shell.setRightDrawerOpen(false);
          shell.setActiveDrawerPage("ATTENDANCE");
        }}
        onOpenPushProducts={() => {
          shell.setRightDrawerOpen(false);
          shell.setActiveDrawerPage("NONE");
          shell.setActiveTab("PUSH_PRODUCTS");
        }}
        onOpenChangePassword={shell.handleOpenChangePwd}
        onLogout={shell.handleLogout}
      />

      <WebChangePasswordModal
        username={currentUser.username}
        isOpen={shell.showChangePwdModal}
        currentPassword={shell.currentPassword}
        onCurrentPasswordChange={shell.setCurrentPassword}
        newPassword={shell.newPassword}
        onNewPasswordChange={shell.setNewPassword}
        confirmPassword={shell.confirmPassword}
        onConfirmPasswordChange={shell.setConfirmPassword}
        pwdSaving={shell.pwdSaving}
        pwdMessage={shell.pwdMessage}
        onClose={() => shell.setShowChangePwdModal(false)}
        onSubmit={shell.handleChangePasswordSubmit}
      />

      <InvoicePdfModal
        order={shell.invoiceOrder}
        onClose={() => shell.setInvoiceOrder(null)}
      />

      <MobileRowDetailModal />

      <WiseCalculatorStash />

      <WebBottomNavbar
        currentUser={currentUser}
        activeTab={shell.activeTab}
        activeDrawerPage={shell.activeDrawerPage}
        hasUnseenShiftSchedule={shell.hasUnseenShiftSchedule}
        onSelectTab={(tabId) => {
          shell.setActiveDrawerPage("NONE");
          shell.setActiveTab(tabId);
        }}
        onOpenAttendance={() => {
          shell.setLeftDrawerOpen(false);
          shell.setRightDrawerOpen(false);
          shell.setActiveDrawerPage("ATTENDANCE");
        }}
        onOpenLeftDrawer={() => shell.setLeftDrawerOpen(true)}
        onOpenRightDrawer={() => shell.setRightDrawerOpen(true)}
      />
    </div>
  );
}
