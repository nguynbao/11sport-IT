"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  evaluateExpression,
  type WiseRateResponse,
} from "../utils/wiseCalculator";

export function useWiseCalculator() {
  const [isOpen, setIsOpen] = useState(false);
  const [isStashedEdge, setIsStashedEdge] = useState(true);

  const [sourceCurrency, setSourceCurrency] = useState<string>("USD");
  const [targetCurrency, setTargetCurrency] = useState<string>("VND");
  const [rawExpression, setRawExpression] = useState<string>("100");

  // Tỷ giá lấy trực tiếp từ Wise API (không hardcode)
  const [rate, setRate] = useState<number | null>(null);
  const [rateDisplay, setRateDisplay] = useState<string>("Đang lấy tỷ giá Wise...");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const fetchWiseRate = useCallback(async (src: string, tgt: string) => {
    if (src === tgt) {
      setRate(1);
      setRateDisplay(`1 ${src} = 1 ${tgt}`);
      setErrorMsg("");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const response = await fetch(
        `/api/wise-rate?source=${encodeURIComponent(src)}&target=${encodeURIComponent(tgt)}`,
        { cache: "no-store" }
      );
      const json: WiseRateResponse = await response.json();
      if (!response.ok || !json.data || !(json.data.rate > 0)) {
        throw new Error(json.message || "Không lấy được tỷ giá từ Wise API");
      }
      setRate(json.data.rate);
      setRateDisplay(json.data.rateDisplay);
    } catch (err: any) {
      setRate(null);
      setRateDisplay("Lỗi kết nối Wise API");
      setErrorMsg(err?.message || "Không thể kết nối tới Wise API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchWiseRate(sourceCurrency, targetCurrency);
  }, [isOpen, sourceCurrency, targetCurrency, fetchWiseRate]);

  const numericInput = evaluateExpression(rawExpression);
  const hasOperator = /[+\-*:/.]/.test(rawExpression.replace(/^\d+(\.\d+)?$/, ""));
  const convertedValue = rate !== null ? numericInput * rate : 0;

  const targetDecimals =
    targetCurrency === "VND"
      ? 0
      : convertedValue > 0 && convertedValue < 1
      ? 4
      : 2;

  const handleSwap = () => {
    const prevSrc = sourceCurrency;
    const prevTgt = targetCurrency;
    setSourceCurrency(prevTgt);
    setTargetCurrency(prevSrc);
  };

  const handleKeyPress = (key: string) => {
    if (key === "C") {
      setRawExpression("");
      return;
    }
    if (key === "BACK") {
      setRawExpression((prev) => prev.slice(0, -1));
      return;
    }
    if (key === "=") {
      const val = evaluateExpression(rawExpression);
      const decimals = sourceCurrency === "VND" ? 0 : 2;
      const factor = Math.pow(10, decimals);
      setRawExpression(String(Math.round(val * factor) / factor));
      return;
    }

    const operators = ["+", "-", "*", ":"];
    setRawExpression((prev) => {
      if (operators.includes(key)) {
        if (!prev) return "";
        if (operators.includes(prev.slice(-1))) {
          return prev.slice(0, -1) + key;
        }
        return prev + key;
      }
      if (prev === "0" && key !== ".") {
        return key;
      }
      return prev + key;
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
      .replace(/,/g, "")
      .replace(/\s+/g, "")
      .replace(/\//g, ":")
      .replace(/x|X|×/g, "*")
      .replace(/÷/g, ":")
      .replace(/[^0-9+\-*:/.]/g, "");
    setRawExpression(val);
  };

  return {
    isOpen,
    setIsOpen,
    isStashedEdge,
    setIsStashedEdge,
    sourceCurrency,
    setSourceCurrency,
    targetCurrency,
    setTargetCurrency,
    rawExpression,
    rate,
    rateDisplay,
    loading,
    errorMsg,
    fetchWiseRate,
    numericInput,
    hasOperator,
    convertedValue,
    targetDecimals,
    handleSwap,
    handleKeyPress,
    handleInputChange,
  };
}
