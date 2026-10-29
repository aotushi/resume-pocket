# Word → PDF 转换容器：LibreOffice 无界面版 + 中文字体，由 worker/index.ts 中的 WordConverter 调用
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8 HOME=/tmp
# 可选 apt 镜像（wrangler.jsonc 的 image_vars 传入），留空则用 Debian 官方源
ARG APT_MIRROR=""
RUN if [ -n "$APT_MIRROR" ]; then sed -i "s|deb.debian.org|$APT_MIRROR|g" /etc/apt/sources.list.d/debian.sources; fi \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
      libreoffice-writer-nogui python3 fontconfig \
      fonts-noto-cjk fonts-wqy-microhei \
      fonts-liberation2 fonts-crosextra-carlito fonts-crosextra-caladea fonts-dejavu-core \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

# 常见 Windows 中文字体在容器里没有，按衬线/无衬线映射到思源（Noto CJK），避免回退成方块或错位
COPY fonts.conf /etc/fonts/local.conf
RUN fc-cache -f

# 预先生成 LibreOffice 用户配置（含禁用宏），每次转换复制一份，省掉首次启动初始化
COPY registrymodifications.xcu /opt/lo-template/user/registrymodifications.xcu
RUN echo warmup > /tmp/warmup.txt \
 && soffice -env:UserInstallation=file:///opt/lo-template --headless --norestore --convert-to pdf --outdir /tmp /tmp/warmup.txt \
 && rm -f /tmp/warmup.* \
 && chmod -R a+rX /opt/lo-template

COPY server.py /opt/server.py
EXPOSE 8080
USER nobody
CMD ["python3", "/opt/server.py"]
