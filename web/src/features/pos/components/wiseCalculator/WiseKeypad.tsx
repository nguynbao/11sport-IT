import { Delete } from "lucide-react";

interface WiseKeypadProps {
  onKeyPress: (key: string) => void;
}

export default function WiseKeypad({ onKeyPress }: WiseKeypadProps) {
  return (
            <div className="grid grid-cols-4 gap-1.5 bg-slate-100 p-2 rounded-xl border border-slate-200">
              {[
                {
                  label: "C",
                  value: "C",
                  style:
                    "bg-red-50 text-red-600 hover:bg-red-100 border-red-200",
                },
                {
                  label: "⌫",
                  value: "BACK",
                  style:
                    "bg-white text-slate-700 hover:bg-slate-50 border-slate-200",
                },
                {
                  label: "000",
                  value: "000",
                  style:
                    "bg-white text-brand-ink hover:bg-blue-50 border-slate-200",
                },
                {
                  label: ":",
                  value: ":",
                  style:
                    "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200",
                },
                { label: "7", value: "7" },
                { label: "8", value: "8" },
                { label: "9", value: "9" },
                {
                  label: "*",
                  value: "*",
                  style:
                    "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200",
                },
                { label: "4", value: "4" },
                { label: "5", value: "5" },
                { label: "6", value: "6" },
                {
                  label: "-",
                  value: "-",
                  style:
                    "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200",
                },
                { label: "1", value: "1" },
                { label: "2", value: "2" },
                { label: "3", value: "3" },
                {
                  label: "+",
                  value: "+",
                  style:
                    "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200",
                },
                { label: "0", value: "0" },
                { label: "00", value: "00" },
                { label: ".", value: "." },
                {
                  label: "=",
                  value: "=",
                  style:
                    "bg-blue-600 text-white hover:bg-blue-700 border-blue-600",
                },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => onKeyPress(btn.value)}
                  className={`h-10 rounded-lg font-mono font-extrabold text-sm border flex items-center justify-center transition active:scale-95 ${
                    btn.style ||
                    "bg-white hover:bg-blue-50 text-slate-900 border-slate-200"
                  }`}
                >
                  {btn.value === "BACK" ? (
                    <Delete className="w-4 h-4" />
                  ) : (
                    btn.label
                  )}
                </button>
              ))}
            </div>
  );
}
