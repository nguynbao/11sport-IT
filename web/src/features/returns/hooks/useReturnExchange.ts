import { useExchangeCart } from "./useExchangeCart";
import { useReturnOrders } from "./useReturnOrders";
import { useReturnCalculation } from "./useReturnCalculation";
import { useReturnSubmit } from "./useReturnSubmit";

export function useReturnExchange() {
  const mode = "EXCHANGE" as const;

  const {
    exchangeRows,
    setExchangeRows,
    exchangeSearch,
    setExchangeSearch,
    loadingProducts,
    reloadSellableProducts,
    applySellableList,
    exchangeOptions,
    filteredExchangeOptions,
    selectedQtyByOptionKey,
    handleAddExchangeOption,
    handleChangeExchangeDiscount,
    handleChangeExchangeDesiredPrice,
    handleExchangeSearchKeyDown,
  } = useExchangeCart();

  const {
    orderCodeInput,
    setOrderCodeInput,
    selectedOrder,
    recentReturns,
    returnRows,
    setReturnRows,
    loading,
    errorMsg,
    setErrorMsg,
    successMsg,
    setSuccessMsg,
    matchingRecentOrders,
    prepareOrderForReturn,
    handleSearchOrder,
    loadInitialLists,
  } = useReturnOrders({ setExchangeRows, setExchangeSearch, applySellableList });

  const calc = useReturnCalculation({
    selectedOrder,
    returnRows,
    exchangeRows,
    recentReturns,
    mode,
  });

  const { refundMethod, setRefundMethod, note, setNote, submitting, handleSubmitReturnExchange } =
    useReturnSubmit({
      selectedOrder,
      returnRows,
      exchangeRows,
      mode,
      isDowngradeBlocked: calc.isDowngradeBlocked,
      listedShortfall: calc.listedShortfall,
      setErrorMsg,
      setSuccessMsg,
      loadInitialLists,
      prepareOrderForReturn,
    });

  return {
    orderCodeInput,
    setOrderCodeInput,
    selectedOrder,
    recentReturns,
    mode,
    refundMethod,
    setRefundMethod,
    note,
    setNote,
    returnRows,
    setReturnRows,
    exchangeRows,
    setExchangeRows,
    exchangeSearch,
    setExchangeSearch,
    loading,
    loadingProducts,
    submitting,
    errorMsg,
    successMsg,
    reloadSellableProducts,
    exchangeOptions,
    filteredExchangeOptions,
    selectedQtyByOptionKey,
    matchingRecentOrders,
    prepareOrderForReturn,
    handleSearchOrder,
    handleAddExchangeOption,
    handleChangeExchangeDiscount,
    handleChangeExchangeDesiredPrice,
    handleExchangeSearchKeyDown,
    ...calc,
    handleSubmitReturnExchange,
  };
}
