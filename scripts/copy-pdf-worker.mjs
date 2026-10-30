import { copyFile, cp, mkdir, readFile, rm } from "node:fs/promises";

// 用 legacy 构建：现代构建直接调用 Map.getOrInsert 等新 API，不少手机浏览器内核较旧会加载失败
// 按 pdfjs 版本号分目录存放，public/_headers 给 /pdfjs/* 一年缓存；升级 pdfjs 即换目录，浏览器不会拿到旧文件

const { version } = JSON.parse(await readFile(new URL("../node_modules/pdfjs-dist/package.json", import.meta.url), "utf8"));
const target = new URL(`../public/pdfjs/${version}/`, import.meta.url);

await rm(new URL("../public/pdfjs/", import.meta.url), { recursive: true, force: true });
await rm(new URL("../public/pdf.worker.min.mjs", import.meta.url), { force: true });
await mkdir(target, { recursive: true });
await copyFile(new URL("../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url), new URL("pdf.worker.min.mjs", target));
for (const directory of ["cmaps", "standard_fonts", "wasm"]) {
  await cp(new URL(`../node_modules/pdfjs-dist/${directory}/`, import.meta.url), new URL(`${directory}/`, target), { recursive: true });
}
