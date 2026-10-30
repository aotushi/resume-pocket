import { copyFile, cp, mkdir } from "node:fs/promises";

// 用 legacy 构建：现代构建直接调用 Map.getOrInsert 等新 API，不少手机浏览器内核较旧会加载失败

await copyFile(
  new URL("../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url),
  new URL("../public/pdf.worker.min.mjs", import.meta.url),
);
await mkdir(new URL("../public/pdfjs/", import.meta.url), { recursive: true });
for (const directory of ["cmaps", "standard_fonts", "wasm"]) {
  await cp(
    new URL(`../node_modules/pdfjs-dist/${directory}/`, import.meta.url),
    new URL(`../public/pdfjs/${directory}/`, import.meta.url),
    { recursive: true },
  );
}
