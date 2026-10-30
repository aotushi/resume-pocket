"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { loadPdfjs, openPdf } from "@/lib/pdf-render";

type Props = { url: string; onReady: (ready: boolean) => void };
type PreviewError = "password" | "invalid" | "other";

// 按 pdf.js 的异常名区分原因；其余（多为浏览器内核不支持或网络问题）统一引导下载或换浏览器
const ERROR_TEXT: Record<PreviewError, string> = {
  password: "这份文件设有密码，无法在线预览，可下载后输入密码查看",
  invalid: "文件可能已损坏，无法在线预览，可尝试下载原文件",
  other: "当前浏览器暂时无法预览，可下载原文件，或换用系统浏览器打开",
};

export function PdfPreview({ url, onReady }: Props) {
  // 首次渲染就开始下载 pdf.js，不等组件挂载
  if (typeof window !== "undefined") void loadPdfjs();
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<PreviewError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => Promise<void>) | undefined;
    const container = containerRef.current;
    if (!container) return;
    container.replaceChildren();
    setError(null);
    setLoading(true);
    onReady(false);

    async function render() {
      try {
        // 文件与 pdf.js 并行下载（分享页 HTML 里已预加载两者）
        const loadingTask = await openPdf(url);
        if (cancelled) { void loadingTask.destroy(); return; }
        destroy = () => loadingTask.destroy();
        const pdf = await loadingTask.promise;
        for (let number = 1; number <= pdf.numPages; number++) {
          if (cancelled || !container) return;
          const page = await pdf.getPage(number);
          const base = page.getViewport({ scale: 1 });
          // Keep the same print resolution on phones and desktop screens.
          const viewport = page.getViewport({ scale: (794 / base.width) * 2 });
          const canvas = document.createElement("canvas");
          canvas.className = "pdf-page";
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${viewport.width / 2}px`;
          canvas.setAttribute("aria-label", `简历第 ${number} 页`);
          container.appendChild(canvas);
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas unavailable");
          await page.render({ canvas, canvasContext: context, viewport }).promise;
        }
        if (!cancelled) { setLoading(false); onReady(true); }
      } catch (cause) {
        if (!cancelled) { console.error("Could not render PDF", cause); setLoading(false); setError(errorKind(cause)); }
      }
    }
    void render();
    return () => { cancelled = true; void destroy?.(); };
  }, [url, onReady]);

  return <>
    {loading && <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground print:hidden" role="status"><Spinner />正在打开简历，请稍等…</div>}
    {error && <div className="mx-auto max-w-sm py-16 text-center text-sm leading-relaxed text-destructive print:hidden" role="alert">{ERROR_TEXT[error]}</div>}
    <div id="resume-print-area" className="flex w-full flex-col items-center gap-4 print:block" ref={containerRef} aria-busy={loading} />
  </>;
}

function errorKind(cause: unknown): PreviewError {
  const name = (cause as { name?: string } | null)?.name;
  if (name === "PasswordException") return "password";
  if (name === "InvalidPDFException") return "invalid";
  return "other";
}
