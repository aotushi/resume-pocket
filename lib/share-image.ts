/**
 * 「图片」分享：把简历每一页和这条链接的二维码拼成一张长图，不带下载、打印等页面按钮。
 * 尺寸以 A4 页宽 794 CSS px 为基准，按 2 倍输出；页数多时自动降低倍率，
 * 让总像素不超过 iOS Safari 的画布上限（约 1677 万像素），高度不超过 Chrome 的 32767px。
 */
import QRCode from "qrcode";
import { openPdf } from "@/lib/pdf-render";

const PAGE_WIDTH = 794;
const PADDING = 24;
const GAP = 16;
const FOOTER = 132;
const QR_SIZE = 100;
const MAX_SCALE = 2;
const MAX_AREA = 16_777_216;
const MAX_HEIGHT = 32_000;
const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif';

type Options = { fileUrl: string; shareUrl: string; expiresAt: string | null };

export async function renderShareImage({ fileUrl, shareUrl, expiresAt }: Options) {
  const loadingTask = await openPdf(fileUrl);
  try {
    const pdf = await loadingTask.promise;
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number++) pages.push(await pdf.getPage(number));
    // 每页按页宽 794 换算出 CSS 高度，先算整图尺寸再定倍率
    const heights = pages.map((page) => { const base = page.getViewport({ scale: 1 }); return (base.height * PAGE_WIDTH) / base.width; });
    const width = PAGE_WIDTH + PADDING * 2;
    const height = PADDING * 2 + heights.reduce((sum, value) => sum + value + GAP, 0) + FOOTER;
    const scale = Math.min(MAX_SCALE, Math.sqrt(MAX_AREA / (width * height)), MAX_HEIGHT / height);

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(width * scale);
    canvas.height = Math.floor(height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.scale(scale, scale);
    context.fillStyle = "#f1f3f6";
    context.fillRect(0, 0, width, height);

    let top = PADDING;
    for (const [index, page] of pages.entries()) {
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (PAGE_WIDTH / base.width) * scale });
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = Math.floor(viewport.width);
      pageCanvas.height = Math.floor(viewport.height);
      const pageContext = pageCanvas.getContext("2d");
      if (!pageContext) throw new Error("Canvas unavailable");
      await page.render({ canvas: pageCanvas, canvasContext: pageContext, viewport }).promise;
      context.save();
      context.shadowColor = "rgba(15, 23, 42, 0.12)";
      context.shadowBlur = 12;
      context.shadowOffsetY = 2;
      context.fillStyle = "#fff";
      context.fillRect(PADDING, top, PAGE_WIDTH, heights[index]);
      context.restore();
      context.drawImage(pageCanvas, PADDING, top, PAGE_WIDTH, heights[index]);
      top += heights[index] + GAP;
      pageCanvas.width = pageCanvas.height = 0;
    }

    await drawFooter(context, { top, width, scale, shareUrl, expiresAt });
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Export failed")), "image/png"));
  } finally {
    void loadingTask.destroy();
  }
}

async function drawFooter(context: CanvasRenderingContext2D, { top, width, scale, shareUrl, expiresAt }: { top: number; width: number; scale: number; shareUrl: string; expiresAt: string | null }) {
  const left = PADDING;
  const cardWidth = width - PADDING * 2;
  context.fillStyle = "#fff";
  roundRect(context, left, top, cardWidth, FOOTER, 12);
  context.fill();

  // 二维码按输出像素生成，避免缩放后边缘发虚
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, shareUrl, { margin: 0, width: Math.round(QR_SIZE * scale), errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } });
  const qrTop = top + (FOOTER - QR_SIZE) / 2;
  context.imageSmoothingEnabled = false;
  context.drawImage(qr, left + 20, qrTop, QR_SIZE, QR_SIZE);
  context.imageSmoothingEnabled = true;

  const textLeft = left + 20 + QR_SIZE + 24;
  context.textBaseline = "alphabetic";
  context.fillStyle = "#0f172a";
  context.font = `600 24px ${FONT}`;
  context.fillText("扫码查看最新在线版", textLeft, qrTop + 34);
  context.fillStyle = "#64748b";
  context.font = `16px ${FONT}`;
  context.fillText(expiresAt ? `链接有效期至 ${formatExpiry(expiresAt)}` : "链接长期有效", textLeft, qrTop + 64);
  context.font = `500 14px ${FONT}`;
  context.fillStyle = "#94a3b8";
  context.fillText("简历口袋 · 简历放网上，发个链接就能投", textLeft, qrTop + QR_SIZE - 4);
}

function formatExpiry(date: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

/** 手机上走系统分享面板（可直接发微信等），电脑上直接下载 */
export async function saveShareImage(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: "image/png" });
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      // 用户取消分享面板就此结束；生成耗时过久导致浏览器拒绝分享时改为下载
      if ((error as Error).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
