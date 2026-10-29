"""
最小转换服务：POST /convert，请求体是 Word 原件，X-Source-Type 为 docx 或 doc，成功返回 PDF。
每次转换复制一份预热好的 LibreOffice 配置并在独立临时目录里进行，结束即删除，不留存用户文件。
"""
import os
import shutil
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_BYTES = 10 * 1024 * 1024
TIMEOUT_SECONDS = 60
# 同时最多两个 soffice 进程，避免小规格实例内存被打满
slots = threading.BoundedSemaphore(2)


def convert(source: bytes, ext: str) -> bytes:
    work = tempfile.mkdtemp(prefix="convert-")
    try:
        profile = os.path.join(work, "profile")
        shutil.copytree("/opt/lo-template", profile)
        src = os.path.join(work, f"resume.{ext}")
        with open(src, "wb") as file:
            file.write(source)
        subprocess.run(
            ["soffice", f"-env:UserInstallation=file://{profile}", "--headless", "--norestore",
             "--nolockcheck", "--convert-to", "pdf:writer_pdf_Export", "--outdir", work, src],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=TIMEOUT_SECONDS, check=False,
        )
        out = os.path.join(work, "resume.pdf")
        if not os.path.exists(out):
            raise ValueError("conversion produced no output")
        with open(out, "rb") as file:
            return file.read()
    finally:
        shutil.rmtree(work, ignore_errors=True)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def do_POST(self):
        ext = self.headers.get("X-Source-Type", "")
        length = int(self.headers.get("Content-Length", "0"))
        if self.path != "/convert" or ext not in ("docx", "doc") or not 0 < length <= MAX_BYTES:
            self.send_error(400)
            return
        source = self.rfile.read(length)
        try:
            with slots:
                pdf = convert(source, ext)
        except Exception as error:  # 超时、文件损坏、加密文档等都按转换失败处理
            self.log_message("convert failed: %s", type(error).__name__)
            self.send_error(422)
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Length", str(len(pdf)))
        self.end_headers()
        self.wfile.write(pdf)


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
