"use client";

/**
 * 「我的简历」：上传、列表、预览、打印、下载、删除，均对接现有 /api/resumes。
 * 选中简历下方是它的分享链接面板（游客空间由 GuestSpace 自行放置）。
 * guest 模式用于 /try 游客空间：同一套接口按游客 Cookie 识别所有者，只能保存 1 份，并显示自动删除时间。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, CloudUpload, ExternalLink, FileDown, FileText, MoreHorizontal, Plus, Printer, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Resume } from "@/app/lib/resumes";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ShareLinksPanel } from "@/components/share/share-links-panel";
import { cn } from "@/lib/utils";
import { PageHeader } from "./page-header";
import { PdfPreview } from "./pdf-preview";

const MAX_BYTES = 10 * 1024 * 1024;
// 注册用户可传 Word（转换为 PDF 预览），游客只能传 PDF
const PDF_ACCEPT = "application/pdf,.pdf";
const WORD_ACCEPT = `${PDF_ACCEPT},.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword`;

const formatSize = (bytes: number) => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const formatDate = (date: string) => new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
const formatDay = (date: string) => new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(new Date(date));

type Props = { guest?: boolean; onResumesChange?: (resumes: Resume[]) => void };

export function ResumeWorkspace({ guest = false, onResumesChange }: Props) {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [printReady, setPrintReady] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Resume | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingLinks, setPendingLinks] = useState<{ id: string; count: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const selectedIdRef = useRef<string | null>(null);
  const selected = resumes.find((resume) => resume.id === selectedId) ?? null;
  const canUpload = !guest || resumes.length === 0;
  const uploadingLabel = converting ? "正在转换 Word…" : "上传中…";

  const updateResumes = useCallback((next: Resume[]) => {
    setResumes(next);
    onResumesChange?.(next);
  }, [onResumesChange]);

  const chooseResume = useCallback((id: string | null) => {
    if (selectedIdRef.current !== id) setPrintReady(false);
    selectedIdRef.current = id;
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("resume", id);
    else url.searchParams.delete("resume");
    window.history.replaceState(null, "", url);
  }, []);

  const load = useCallback(() => {
    let active = true;
    fetch("/api/resumes", { cache: "no-store" })
      .then(async (response) => {
        // 游客还没上传过时没有 Cookie，按空空间处理
        if (response.status === 401 && guest) { if (active) updateResumes([]); return; }
        if (response.status === 401) { window.location.href = "/?auth=signin&next=/app"; return; }
        const data = await response.json() as { error?: string; resumes: Resume[] };
        if (!response.ok) throw new Error(data.error || "无法读取简历。");
        if (!active) return;
        updateResumes(data.resumes);
        const requested = new URL(window.location.href).searchParams.get("resume");
        chooseResume(data.resumes.find((item) => item.id === requested)?.id ?? data.resumes[0]?.id ?? null);
      })
      .catch((error: Error) => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [chooseResume, guest, updateResumes]);

  useEffect(() => load(), [load]);

  async function upload(file?: File) {
    if (!file || uploading || !canUpload) return;
    const lower = file.name.toLowerCase();
    const isWord = lower.endsWith(".docx") || lower.endsWith(".doc");
    if (guest && isWord) { toast.error("游客空间只支持 PDF。注册后即可上传 Word 简历。"); return; }
    if (!lower.endsWith(".pdf") && !isWord) { toast.error(guest ? "请选择 PDF 格式的简历。" : "请选择 PDF 或 Word（DOCX、DOC）格式的简历。"); return; }
    if (file.size > MAX_BYTES) { toast.error("文件不能超过 10 MB。"); return; }
    setUploading(true);
    setConverting(isWord);
    try {
      const response = await fetch("/api/resumes", { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream", "X-Resume-Name": encodeURIComponent(file.name) }, body: file });
      const data = await response.json() as { error?: string; resume: Resume };
      if (!response.ok) throw new Error(data.error || "上传失败，请重试。");
      updateResumes([data.resume, ...resumes]);
      chooseResume(data.resume.id);
      toast.success("上传成功", { description: data.resume.name });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传失败，请重试。");
    } finally {
      setUploading(false);
      setConverting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  // 删除前告知会失效的分享链接数量；读取失败时只是不显示数量
  useEffect(() => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    let active = true;
    fetch(`/api/shares?resume=${id}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ links: unknown[] }> : null)
      .then((data) => { if (active && data) setPendingLinks({ id, count: data.links.length }); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [pendingDelete]);

  async function removeResume() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/resumes/${pendingDelete.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || "删除失败，请重试。");
      }
      const remaining = resumes.filter((resume) => resume.id !== pendingDelete.id);
      updateResumes(remaining);
      if (selectedId === pendingDelete.id) chooseResume(remaining[0]?.id ?? null);
      toast.success("这份简历已删除。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败，请重试。");
    } finally { setDeleting(false); setPendingDelete(null); }
  }

  function select(id: string) {
    chooseResume(id);
    // 窄屏上列表和预览纵向排列，选中后滚到预览
    if (window.matchMedia("(max-width: 1023px)").matches) previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const dropHandlers = {
    onDragOver: (event: React.DragEvent) => { event.preventDefault(); setDragging(true); },
    onDragLeave: () => setDragging(false),
    onDrop: (event: React.DragEvent) => { event.preventDefault(); setDragging(false); void upload(event.dataTransfer.files[0]); },
  };

  return <TooltipProvider>
    <input ref={inputRef} className="sr-only" type="file" accept={guest ? PDF_ACCEPT : WORD_ACCEPT} aria-label={guest ? "选择 PDF 简历" : "选择 PDF 或 Word 简历"} tabIndex={-1}
      onChange={(event) => { const file = event.currentTarget.files?.[0]; void upload(file); }} />

    <PageHeader title={guest ? "游客空间" : "我的简历"}
      description={guest ? "无需注册：上传 1 份 PDF 简历，预览后创建短期分享链接。" : "保存、预览并下载你准备好的 PDF 或 Word 简历。"}
      actions={resumes.length > 0 && canUpload && <Button size="lg" className="h-11" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? <Spinner /> : <Plus />}{uploading ? uploadingLabel : "上传简历"}
      </Button>} />

    {loading ? <LoadingState /> : loadError ? <div className="mt-8 rounded-xl border bg-card p-10 text-center" role="alert">
      <p className="font-medium">暂时无法读取简历</p>
      <p className="mt-1.5 text-sm text-muted-foreground">{loadError}</p>
      <Button variant="outline" className="mt-5" onClick={() => { setLoading(true); setLoadError(""); load(); }}>重试</Button>
    </div> : resumes.length === 0 ? <div {...dropHandlers} className={cn("mt-8 flex flex-col items-center rounded-xl border-2 border-dashed bg-card px-6 py-16 text-center transition-colors", dragging ? "border-primary bg-secondary" : "border-input/50")}>
      <span className="grid size-14 place-items-center rounded-full bg-secondary text-primary"><CloudUpload className="size-7" /></span>
      <h2 className="mt-5 text-lg font-semibold">{uploading ? uploadingLabel : "还没有简历"}</h2>
      <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">把{guest ? " PDF " : " PDF 或 Word "}简历拖到这里，或点击下方按钮选择文件。单个文件不超过 10 MB。</p>
      <Button size="lg" className="mt-6 h-11" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? <Spinner /> : <Plus />}{uploading ? uploadingLabel : guest ? "选择 PDF 文件" : "选择文件"}
      </Button>
      <p className="mt-6 max-w-md text-xs leading-relaxed text-muted-foreground">{guest ? "游客简历保存 14 天后自动删除；上传即表示同意服务说明中的上传规则。" : "PDF 按原排版呈现；Word（DOCX、DOC）会转换为 PDF 在线预览，下载时提供原文件。"}</p>
    </div> : <div className="mt-8 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] print:block">
      {/* 列表 */}
      <section aria-labelledby="list-title" className="print:hidden">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="list-title" className="text-sm font-semibold">全部简历 <span className="ml-1 font-normal text-muted-foreground">{resumes.length}</span></h2>
          <span className="text-xs text-muted-foreground">最近上传在前</span>
        </div>
        <ul className="grid gap-2">
          {resumes.map((resume) => {
            const active = resume.id === selectedId;
            return <li key={resume.id}>
              <button onClick={() => select(resume.id)} aria-pressed={active}
                className={cn("flex w-full items-center gap-3 rounded-lg border bg-card p-3.5 text-left transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", active && "border-primary bg-secondary/60 ring-1 ring-primary")}>
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-md", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}><FileText className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{resume.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{formatDate(resume.uploadedAt)} · {formatSize(resume.size)}</span>
                  {resume.deleteAt && <span className="mt-0.5 block text-xs text-warning">{formatDay(resume.deleteAt)}自动删除</span>}
                </span>
              </button>
            </li>;
          })}
        </ul>
        {canUpload ? <div {...dropHandlers} className={cn("mt-3 rounded-lg border-2 border-dashed p-4 text-center text-xs text-muted-foreground transition-colors", dragging ? "border-primary bg-secondary text-secondary-foreground" : "border-border")}>
          {uploading ? uploadingLabel : guest ? "拖放 PDF 到这里快速上传" : "拖放 PDF 或 Word 到这里快速上传"}
        </div> : <p className="mt-3 rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">游客只能保存 1 份简历。要换一份，请先删除这份；注册后可保存多份。</p>}
      </section>

      {/* 预览 */}
      {selected && <section ref={previewRef} aria-label="简历预览" className="min-w-0 overflow-hidden rounded-xl border bg-card print:overflow-visible print:rounded-none print:border-0">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-5 print:hidden">
          <div className="min-w-48 flex-1">
            <p className="truncate font-semibold">{selected.name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">{formatSize(selected.size)}<Badge variant="secondary" className="font-normal">仅自己可见</Badge>{selected.source !== "pdf" && <span>预览为转换后的 PDF，排版可能与 Word 略有差异</span>}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild><a href="#share-links"><Share2 />分享</a></Button>
            <Button variant="outline" disabled={!printReady} onClick={() => window.print()} title={printReady ? "打印简历" : "正在准备预览"}><Printer /><span className="hidden sm:inline">打印</span></Button>
            <Button asChild><a href={`/api/resumes/${selected.id}?download=1`} download title={selected.source !== "pdf" ? "下载 Word 原文件" : undefined}><ArrowDownToLine /><span className="hidden sm:inline">下载</span></a></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="更多操作"><MoreHorizontal /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild><a href={`/api/resumes/${selected.id}`} target="_blank" rel="noopener noreferrer"><ExternalLink />在新标签页打开</a></DropdownMenuItem>
                {selected.source !== "pdf" && <DropdownMenuItem asChild><a href={`/api/resumes/${selected.id}?download=pdf`} download><FileDown />下载 PDF 版本</a></DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setPendingDelete(selected)}><Trash2 />删除</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="max-h-[calc(100vh-14rem)] min-h-[420px] overflow-auto bg-[#e9edf2] p-4 sm:p-8 print:max-h-none print:min-h-0 print:overflow-visible print:bg-white print:p-0">
          <PdfPreview key={selected.id} url={`/api/resumes/${selected.id}`} onReady={setPrintReady} />
        </div>
      </section>}
    </div>}

    {!guest && !loading && selected && <div className="mt-6"><ShareLinksPanel key={selected.id} resume={selected} /></div>}

    <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open && !deleting) setPendingDelete(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除这份简历？</AlertDialogTitle>
          <AlertDialogDescription className="break-all">「{pendingDelete?.name}」将从你的空间中永久删除{pendingLinks?.id === pendingDelete?.id && pendingLinks?.count ? `，它的 ${pendingLinks.count} 条分享链接将全部失效` : ""}，此操作无法撤销。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" disabled={deleting} onClick={(event) => { event.preventDefault(); void removeResume(); }}>
            {deleting && <Spinner />}{deleting ? "删除中…" : "确认删除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </TooltipProvider>;
}

function LoadingState() {
  return <div className="mt-8 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]" role="status" aria-label="正在读取简历">
    <div className="grid content-start gap-2">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-[68px] rounded-lg" />)}</div>
    <Skeleton className="h-[520px] rounded-xl" />
  </div>;
}
