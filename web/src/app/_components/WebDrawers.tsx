"use client";

import React from "react";
import type { StaffUser } from "@/shared/types";
import DrawerMenu, { type DrawerPageType, type TabType } from "@/shared/ui/DrawerMenu";
import { TABS_CONFIG } from "@/config/tabs";
import { getRoleDisplayName } from "@/config/roles";

interface WebDrawersProps {
  currentUser: StaffUser;
  activeTab: TabType;
  activeDrawerPage: DrawerPageType;
  leftDrawerOpen: boolean;
  rightDrawerOpen: boolean;
  hasUnseenShiftSchedule: boolean;
  onCloseLeftDrawer: () => void;
  onCloseRightDrawer: () => void;
  onSelectTab: (tabId: TabType) => void;
  onOpenProfile: () => void;
  onOpenAttendance: () => void;
  onOpenPushProducts: () => void;
  onOpenChangePassword: () => void;
  onLogout: () => void;
}

export default function WebDrawers({
  currentUser,
  activeTab,
  activeDrawerPage,
  leftDrawerOpen,
  rightDrawerOpen,
  hasUnseenShiftSchedule,
  onCloseLeftDrawer,
  onCloseRightDrawer,
  onSelectTab,
  onOpenProfile,
  onOpenAttendance,
  onOpenPushProducts,
  onOpenChangePassword,
  onLogout,
}: WebDrawersProps) {
  const cmsUrl =
    process.env.NEXT_PUBLIC_CMS_URL ||
    (typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
      ? "http://localhost:3001"
      : "https://11sport-it-m1ei.vercel.app");

  return (
    <>
      <DrawerMenu
        isOpen={leftDrawerOpen}
        onClose={onCloseLeftDrawer}
        side="left"
        currentUser={currentUser}
        tabs={TABS_CONFIG}
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        activeDrawerPage={activeDrawerPage}
        hasAttendanceNoti={hasUnseenShiftSchedule}
        onOpenProfile={onOpenProfile}
        onOpenAttendance={onOpenAttendance}
        onLogout={onLogout}
        getRoleDisplayName={getRoleDisplayName}
      />

      <DrawerMenu
        isOpen={rightDrawerOpen}
        onClose={onCloseRightDrawer}
        side="right"
        currentUser={currentUser}
        activeTab={activeTab}
        activeDrawerPage={activeDrawerPage}
        hasAttendanceNoti={hasUnseenShiftSchedule}
        onOpenProfile={onOpenProfile}
        onOpenAttendance={onOpenAttendance}
        onOpenPushProducts={onOpenPushProducts}
        onOpenChangePassword={onOpenChangePassword}
        onLogout={onLogout}
        getRoleDisplayName={getRoleDisplayName}
        cmsUrl={cmsUrl}
      />
    </>
  );
}
