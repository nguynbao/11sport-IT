"use client";

import React, { useEffect, useRef, useState } from "react";
import { FileText, Download, ExternalLink, X, Loader2, AlertCircle } from "lucide-react";

interface ContractFilePreviewModalProps {
  staffName: string;
  fileName: string;
  fileUrl: string;
  readOnlyLabel?: string;
  onClose: () => void;
}

function dataUrlToArrayBuffer(dataUrl: string): { buffer: ArrayBuffer; mime: string } {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) {
    throw new Error("Định dạng dữ liệu file không hợp lệ");
  }
  const header = dataUrl.slice(0, commaIdx);
  const base64 = dataUrl.slice(commaIdx + 1);
  const mimeMatch = header.match(/data:([^;]+)/i);
  const mime = mimeMatch ? mimeMatch[1].toLowerCase() : "application/octet-stream";

  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return { buffer: bytes.buffer, mime };
}

export default function ContractFilePreviewModal({
  staffName,
  fileName,
  fileUrl,
  readOnlyLabel,
  onClose,
}: ContractFilePreviewModalProps) {
  const docxContainerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewKind, setPreviewKind] = useState<"PDF" | "IMAGE" | "WORD_DOCX" | "WORD_HTML" | "FALLBACK">("FALLBACK");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [wordHtml, setWordHtml] = useState<string>("");
  const [errorText, setErrorText] = useState<string>("");

  const lowerName = (fileName || "").toLowerCase();
  const isPdf =
    lowerName.endsWith(".pdf") || fileUrl.startsWith("data:application/pdf");
  const isImage =
    fileUrl.startsWith("data:image/") ||
    /\.(png|jpe?g|gif|webp|bmp)$/i.test(lowerName);
  const isWord =
    /\.(docx?|rtf)$/i.test(lowerName) ||
    fileUrl.startsWith("data:application/vnd.openxmlformats-officedocument.wordprocessingml") ||
    fileUrl.startsWith("data:application/msword");

  useEffect(() => {
    let createdBlobUrl: string | null = null;
    let cancelled = false;

    async function preparePreview() {
      setLoading(true);
      setErrorText("");
      setWordHtml("");

      try {
        if (isImage) {
          setPreviewKind("IMAGE");
          setLoading(false);
          return;
        }

        if (isPdf) {
          if (fileUrl.startsWith("data:")) {
            const { buffer } = dataUrlToArrayBuffer(fileUrl);
            const blob = new Blob([buffer], { type: "application/pdf" });
            createdBlobUrl = URL.createObjectURL(blob);
            if (!cancelled) {
              setBlobUrl(createdBlobUrl);
              setPreviewKind("PDF");
            }
          } else {
            setBlobUrl(fileUrl);
            setPreviewKind("PDF");
          }
          if (!cancelled) setLoading(false);
          return;
        }

        if (isWord) {
          const { buffer } = dataUrlToArrayBuffer(fileUrl);
          try {
            const docxPreview = await import("docx-preview");
            if (!cancelled) {
              setPreviewKind("WORD_DOCX");
              setLoading(false);
              setTimeout(async () => {
                if (docxContainerRef.current && !cancelled) {
                  docxContainerRef.current.innerHTML = "";
                  try {
                    await docxPreview.renderAsync(buffer, docxContainerRef.current, undefined, {
                      className: "docx-preview-wrapper",
                      inWrapper: true,
                      ignoreWidth: false,
                      ignoreHeight: false,
                    });
                  } catch {
                    const mammoth = await import("mammoth");
                    const res = await mammoth.convertToHtml({ arrayBuffer: buffer });
                    if (!cancelled) {
                      setWordHtml(res.value || "<p>Không có nội dung hiển thị.</p>");
                      setPreviewKind("WORD_HTML");
                    }
                  }
                }
              }, 30);
            }
            return;
          } catch {
            const mammoth = await import("mammoth");
            const res = await mammoth.convertToHtml({ arrayBuffer: buffer });
            if (!cancelled) {
              setWordHtml(res.value || "<p>Không có nội dung hiển thị.</p>");
              setPreviewKind("WORD_HTML");
              setLoading(false);
            }
            return;
          }
        }

        setPreviewKind("FALLBACK");
        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setErrorText(err?.message || "Không thể đọc nội dung file để xem trước.");
          setPreviewKind("FALLBACK");
          setLoading(false);
        }
      }
    }

    preparePreview();

    return () => {
      cancelled = true;
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [fileUrl, fileName, isImage, isPdf, isWord]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-3 sm:p-4 backdrop-blur-xs">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h4 className="font-extrabold text-sm sm:text-base truncate">
                Hợp đồng lao động: {staffName}
              </h4>
              <p className="text-[11px] text-slate-400 font-mono truncate">
                {fileName || "Hop-dong-lao-dong"}
                {readOnlyLabel ? ` • (${readOnlyLabel})` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {blobUrl && (
              <a
                href={blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 border border-slate-700 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Mở tab mới</span>
              </a>
            )}
            <a
              href={fileUrl}
              download={fileName || "hop-dong-lao-dong"}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải xuống</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 bg-slate-100 p-3 sm:p-5 overflow-auto flex flex-col items-center justify-start min-h-[480px]">
          {loading && (
            <div className="my-auto flex flex-col items-center gap-2 text-slate-500 text-xs font-bold">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
              <span>Đang tải bản xem trước hợp đồng...</span>
            </div>
          )}

          {!loading && previewKind === "IMAGE" && (
            <img
              src={fileUrl}
              alt={fileName}
              className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-md bg-white my-auto"
            />
          )}

          {!loading && previewKind === "PDF" && blobUrl && (
            <iframe
              src={blobUrl}
              title={fileName}
              className="w-full h-[76vh] rounded-2xl border border-slate-300 bg-white shadow-inner"
            />
          )}

          {!loading && previewKind === "WORD_DOCX" && (
            <div className="w-full overflow-auto bg-slate-200/70 rounded-2xl p-2 sm:p-4 border border-slate-300">
              <div
                ref={docxContainerRef}
                className="mx-auto bg-white rounded-xl shadow-sm p-2 sm:p-6 min-h-[65vh] text-slate-900"
              />
            </div>
          )}

          {!loading && previewKind === "WORD_HTML" && (
            <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-md border border-slate-200 p-6 sm:p-10 min-h-[65vh] prose prose-slate max-w-none text-sm leading-relaxed">
              <div dangerouslySetInnerHTML={{ __html: wordHtml }} />
            </div>
          )}

          {!loading && previewKind === "FALLBACK" && (
            <div className="my-auto text-center p-8 bg-white rounded-2xl border border-slate-200 max-w-md space-y-3 shadow-sm">
              {errorText ? (
                <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
              ) : (
                <FileText className="w-10 h-10 text-emerald-600 mx-auto" />
              )}
              <div className="text-sm font-bold text-slate-800">{fileName}</div>
              <p className="text-xs text-slate-500">
                {errorText ||
                  "File hợp đồng định dạng .doc cổ điển hoặc định dạng đặc biệt — vui lòng bấm Tải xuống để mở bằng Microsoft Word."}
              </p>
              <a
                href={fileUrl}
                download={fileName || "hop-dong-lao-dong"}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow"
              >
                <Download className="w-4 h-4" />
                <span>Tải file hợp đồng về máy</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
