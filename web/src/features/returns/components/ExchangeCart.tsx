import type { ReturnCtx } from "./returnCtx";
import { ExchangeCartMobileCards } from "./ExchangeCartMobileCards";
import { ExchangeCartDesktopTable } from "./ExchangeCartDesktopTable";

type Props = Pick<
  ReturnCtx,
  "exchangeRows" | "setExchangeRows" | "handleChangeExchangeDiscount" | "handleChangeExchangeDesiredPrice"
>;

export default function ExchangeCart(props: Props) {
  if (props.exchangeRows.length === 0) {
    return (
      <div className="p-3 rounded-xl border border-dashed border-blue-300 bg-white/80 text-center text-xs text-slate-600">
        Chưa có sản phẩm đổi mới nào được chọn. Hãy gõ tìm sản phẩm ở ô phía trên và bấm{" "}
        <strong>+ Chọn đổi</strong>.
      </div>
    );
  }

  return (
    <>
      <ExchangeCartMobileCards {...props} />
      <ExchangeCartDesktopTable {...props} />
    </>
  );
}
