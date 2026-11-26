"use client";

import React from "react";
import type { PosServiceState } from "../hooks/usePosService";
import { CheckCircle2, AlertCircle } from "lucide-react";

export default function ServiceMessages({ s }: { s: PosServiceState }) {
  const {
    errorMsg,
    successMsg,
  } = s;

  return (
    <>
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-brand-ink text-xs font-semibold flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}
    </>
  );
}
