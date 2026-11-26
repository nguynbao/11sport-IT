"use client";

import React from "react";
import { useMarketingPushProducts } from "../hooks/useMarketingPushProducts";
import PushFiltersHeader from "./PushFiltersHeader";
import PushKpiCards from "./PushKpiCards";
import PushProductsTable from "./PushProductsTable";

export type { PushProductRow } from "../utils/pushProducts";

export default function MarketingPushProductsTab() {
  const p = useMarketingPushProducts();
  return (
    <div className="space-y-5">
      <PushFiltersHeader p={p} />
      <PushKpiCards p={p} />
      <PushProductsTable p={p} />
    </div>
  );
}
