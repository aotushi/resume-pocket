import { copyFile, cp, mkdir } from "node:fs/promises";

await copyFile(
  new URL("../node_modules/pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
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
