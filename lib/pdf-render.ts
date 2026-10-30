import { PDF_ASSETS, PDF_WORKER_URL } from "@/lib/pdf-assets";

// 首次调用才下载 pdf.js；放在模块顶层执行会让路由预取也下载它
let pdfjsReady: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;
export const loadPdfjs = () => (pdfjsReady ??= import("pdfjs-dist/legacy/build/pdf.mjs"));

export async function fetchPdf(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`File request failed: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

/** 文件与 pdf.js 并行下载，返回 pdf.js 的加载任务（调用方负责 destroy） */
// 整个页面共用一个 worker：不传 worker 时 pdf.js 每次新建，destroy() 时一并关闭，来回切换页面就要反复加载和启动 worker 脚本
let sharedWorker: InstanceType<Awaited<ReturnType<typeof loadPdfjs>>["PDFWorker"]> | null = null;

export async function openPdf(url: string) {
  const [pdfjs, data] = await Promise.all([loadPdfjs(), fetchPdf(url)]);
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
  sharedWorker ??= new pdfjs.PDFWorker();
  return pdfjs.getDocument({
    data,
    worker: sharedWorker,
    cMapUrl: `${PDF_ASSETS}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${PDF_ASSETS}/standard_fonts/`,
    wasmUrl: `${PDF_ASSETS}/wasm/`,
  });
}
