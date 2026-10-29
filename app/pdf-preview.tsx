"use client";

import { useEffect, useRef, useState } from "react";

type Props = { url: string; onReady: (ready: boolean) => void };

export function PdfPreview({ url, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => Promise<void>) | undefined;
    const container = containerRef.current;
    if (!container) return;
    container.replaceChildren();
    setError(false);
    setLoading(true);
    onReady(false);

    async function render() {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const loadingTask = pdfjs.getDocument({
          url,
          withCredentials: true,
          cMapUrl: "/pdfjs/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/pdfjs/standard_fonts/",
          wasmUrl: "/pdfjs/wasm/",
        });
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
        if (!cancelled) { console.error("Could not render PDF", cause); setLoading(false); setError(true); }
      }
    }
    void render();
    return () => { cancelled = true; void destroy?.(); };
  }, [url, onReady]);

  return <>
    {loading && <div className="preview-message" role="status">正在打开简历，请稍等…</div>}
    {error && <div className="preview-message preview-error" role="alert">暂时无法预览这份文件，可能是文件损坏或受密码保护。你仍可下载原文件查看。</div>}
    <div id="resume-print-area" className="pdf-pages" ref={containerRef} aria-busy={loading} />
  </>;
}
