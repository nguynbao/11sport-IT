import { AlertCircle, CheckCircle2 } from "lucide-react";

interface Props {
  errorMsg: string;
  savedNotice: string;
}

export default function ShiftHandoverMessages({ errorMsg, savedNotice }: Props) {
  return (
    <>
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {savedNotice && (
            <div className="p-3.5 bg-blue-50 border border-blue-200 text-brand-ink text-xs font-bold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-ink shrink-0" />
              <span>{savedNotice}</span>
            </div>
          )}
    </>
  );
}
