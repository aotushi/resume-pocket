"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { loadPdfjs, openPdf } from "@/lib/pdf-render";

type Props = { url: string; onReady: (ready: boolean) => void; mode?: "document" | "text"; onPageCount?: (count: number) => void };
type PreviewError = "password" | "invalid" | "other";

// 按 pdf.js 的异常名区分原因；其余（多为浏览器内核不支持或网络问题）统一引导下载或换浏览器
const ERROR_TEXT: Record<PreviewError, string> = {
  password: "这份文件设有密码，无法在线预览，可下载后输入密码查看",
  invalid: "文件可能已损坏，无法在线预览，可尝试下载原文件",
  other: "当前浏览器暂时无法预览，可下载原文件，或换用系统浏览器打开",
};

export function PdfPreview({ url, onReady, mode = "document", onPageCount }: Props) {
  // 首次渲染就开始下载 pdf.js，不等组件挂载
  if (typeof window !== "undefined") void loadPdfjs();
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<PreviewError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => Promise<void>) | undefined;
    const urls: string[] = [];
    const container = containerRef.current;
    const textContainer = textRef.current;
    if (!container || !textContainer) return;
    container.replaceChildren();
    textContainer.replaceChildren();
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
        onPageCount?.(pdf.numPages);
        for (let number = 1; number <= pdf.numPages; number++) {
          if (cancelled || !container) return;
          const page = await pdf.getPage(number);
          const base = page.getViewport({ scale: 1 });
          // Keep the same print resolution on phones and desktop screens.
          const viewport = page.getViewport({ scale: (794 / base.width) * 2 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas unavailable");
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          // 画完转成图片显示：手机浏览器切到后台会回收 canvas 像素且不重画，回到前台变空白；
          // 图片按压缩数据保存，被回收后浏览器会自动重新解码
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
          canvas.width = canvas.height = 0;
          if (!blob) throw new Error("Page export failed");
          const src = URL.createObjectURL(blob);
          urls.push(src);
          if (cancelled) { URL.revokeObjectURL(src); return; }
          const image = new Image();
          image.className = "pdf-page";
          image.src = src;
          image.width = viewport.width / 2;
          image.alt = `简历第 ${number} 页`;
          await image.decode().catch(() => {});
          if (cancelled) return;
          container.appendChild(image);
          // A separate reflowed view keeps text selectable and available to assistive tools.
          const content = await page.getTextContent().catch(() => ({ items: [] }));
          if (cancelled || !textContainer) return;
          const text = content.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim();
          const section = document.createElement("section");
          section.className = "rounded-lg border bg-card p-5 sm:p-8";
          const title = document.createElement("h2");
          title.className = "mb-4 text-sm font-medium text-muted-foreground";
          title.textContent = `第 ${number} / ${pdf.numPages} 页`;
          const paragraph = document.createElement("p");
          paragraph.className = "whitespace-pre-wrap break-words text-base leading-relaxed select-text";
          paragraph.textContent = text || "此页没有可提取的文字，可能是扫描件。请切换到原版预览，或下载文件查看。";
          section.appendChild(title);
          section.appendChild(paragraph);
          textContainer.appendChild(section);
        }
        if (!cancelled) { setLoading(false); onReady(true); }
      } catch (cause) {
        if (!cancelled) { console.error("Could not render PDF", cause); setLoading(false); setError(errorKind(cause)); }
      }
    }
    void render();
    return () => { cancelled = true; void destroy?.(); urls.forEach((src) => URL.revokeObjectURL(src)); };
  }, [url, onReady, onPageCount]);

  return <>
    {loading && <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground print:hidden" role="status"><Spinner />正在打开简历，请稍等…</div>}
    {error && <div className="mx-auto max-w-sm py-16 text-center text-sm leading-relaxed text-destructive print:hidden" role="alert">{ERROR_TEXT[error]}</div>}
    {mode === "text" && <p className="mb-4 text-sm leading-relaxed text-muted-foreground print:hidden">文字从 PDF 提取，可选择和复制；阅读顺序可能受原文排版影响，请以原版为准。</p>}
    <div id="resume-print-area" className={`${mode === "text" ? "hidden" : "flex"} w-full flex-col items-center gap-4 print:block`} ref={containerRef} aria-busy={loading} aria-hidden={mode === "text"} />
    <div className={`${mode === "text" ? "grid" : "hidden"} gap-4 print:hidden`} ref={textRef} aria-busy={loading} />
  </>;
}

function errorKind(cause: unknown): PreviewError {
  const name = (cause as { name?: string } | null)?.name;
  if (name === "PasswordException") return "password";
  if (name === "InvalidPDFException") return "invalid";
  return "other";
}
