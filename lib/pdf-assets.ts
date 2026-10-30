import { version } from "pdfjs-dist/package.json";

// pdf.js 资源目录按版本号区分（scripts/copy-pdf-worker.mjs），可长期缓存
export const PDF_ASSETS = `/pdfjs/${version}`;
export const PDF_WORKER_URL = `${PDF_ASSETS}/pdf.worker.min.mjs`;
