"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine, ArrowRight, Check, ChevronRight, CircleHelp, CloudUpload,
  FileCheck2, FileText, FolderOpen, LockKeyhole, Plus, Printer, ShieldCheck,
  Sparkles, Trash2, X,
} from "lucide-react";
import { PdfPreview } from "./pdf-preview";
import { AuthPanel } from "./auth-panel";
import type { Resume } from "./lib/resumes";

type Props = { user: { name: string } | null };
type Notice = { text: string; kind: "error" | "success" } | null;

const formatSize = (bytes: number) => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const formatDate = (date: string) => new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(new Date(date));

function SampleResume() {
  return <div className="sample-wrap" aria-label="简历预览示意图">
    <div className="sample-paper">
      <div className="sample-topline"><span>HELLO, I'M</span><span>01 / 01</span></div>
      <strong className="sample-name">YOUR<br />NEXT CHAPTER<span>.</span></strong>
      <div className="sample-rule" />
      <div className="sample-role">A LITTLE MORE ABOUT ME</div>
      <div className="sample-layout"><div><b>PROFILE</b><i /><i /><i className="short" /><b>EXPERIENCE</b><i /><i /><i /><i className="short" /></div><div><b>SKILLS</b><i /><i className="short" /><b>EDUCATION</b><i /><i className="short" /></div></div>
      <div className="sample-bottom"><span>YOUR STORY, YOUR WAY</span><span>✳</span></div>
    </div>
    <div className="sample-caption"><span className="status-dot" />上传后在这里预览</div>
  </div>;
}

export function Workspace({ user }: Props) {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(user));
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [printReady, setPrintReady] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [pendingDelete, setPendingDelete] = useState<Resume | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedIdRef = useRef<string | null>(null);
  const selected = resumes.find((resume) => resume.id === selectedId) ?? null;

  const chooseResume = useCallback((id: string | null) => {
    if (selectedIdRef.current !== id) setPrintReady(false);
    selectedIdRef.current = id;
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("resume", id);
    else url.searchParams.delete("resume");
    window.history.replaceState(null, "", url);
  }, []);

  useEffect(() => {
    if (!pendingDelete) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) setPendingDelete(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [pendingDelete, deleting]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetch("/api/resumes", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { error?: string; resumes: Resume[] };
        if (!response.ok) throw new Error(data.error || "无法读取简历。");
        if (!active) return;
        const items = data.resumes as Resume[];
        setResumes(items);
        const requested = new URL(window.location.href).searchParams.get("resume");
        chooseResume(items.find((item) => item.id === requested)?.id ?? items[0]?.id ?? null);
      })
      .catch((error: Error) => { if (active) setNotice({ kind: "error", text: error.message }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, chooseResume]);

  async function upload(file?: File) {
    if (!file || !user || uploading) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setNotice({ kind: "error", text: "请选择 PDF 格式的简历。" }); return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setNotice({ kind: "error", text: "文件不能超过 10 MB。" }); return;
    }
    setUploading(true); setNotice(null);
    try {
      const response = await fetch("/api/resumes", { method: "POST", headers: { "Content-Type": "application/pdf", "X-Resume-Name": encodeURIComponent(file.name) }, body: file });
      const data = await response.json() as { error?: string; resume: Resume };
      if (!response.ok) throw new Error(data.error || "上传失败，请重试。");
      setResumes((current) => [data.resume as Resume, ...current]);
      chooseResume(data.resume.id);
      setNotice({ kind: "success", text: "简历已妥帖收好，可以随时查看。" });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "上传失败，请重试。" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

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
      setResumes(remaining);
      if (selectedId === pendingDelete.id) chooseResume(remaining[0]?.id ?? null);
      setPendingDelete(null);
      setNotice({ kind: "success", text: "这份简历已删除。" });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "删除失败，请重试。" });
      setPendingDelete(null);
    } finally { setDeleting(false); }
  }

  async function signOut() {
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) throw new Error("退出失败，请重试。");
      window.location.href = "/";
    } catch {
      setNotice({ kind: "error", text: "退出失败，请重试。" });
    }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <a href="/" className="brand" aria-label="简历随身首页"><span className="brand-mark"><FileCheck2 size={22} strokeWidth={1.7} /></span><span><b>简历随身</b><small>RESUME POCKET</small></span></a>
      <div className="side-heading">YOUR SPACE <span>／ 你的空间</span></div>
      <nav aria-label="主导航"><a className="side-link active" href="#library" aria-label="我的简历"><FolderOpen size={18} /><span>我的简历</span><ChevronRight size={15} /></a><div className="side-link disabled"><Sparkles size={18} /><span>在线制作</span><small>即将到来</small></div></nav>
      <div className="side-note"><div className="side-note-icon"><LockKeyhole size={17} /></div><strong>安心收好你的故事</strong><p>简历属于你。登录后，只有你能查看和管理自己的文件。</p><span>PRIVATE BY DEFAULT <ArrowRight size={13} /></span></div>
      <div className="side-footer"><span>MADE FOR YOUR NEXT STEP</span><span>✳</span></div>
    </aside>

    <main className="main" id="library">
      <header className="topbar"><div><span className="eyebrow-dot" /> 你的个人简历空间 <span className="topbar-en"> / YOUR RESUME SPACE</span></div><div className="topbar-right"><span className="topbar-private"><ShieldCheck size={15} /> 私密空间</span>{user ? <><span className="user-avatar" title={user.name}>{user.name.slice(0, 1).toUpperCase()}</span><button className="signout-button" onClick={() => void signOut()}>退出</button></> : <a href="#auth">登录</a>}</div></header>

      <div className="content">
        <div className="intro"><div><div className="kicker"><span>THE NEXT OPPORTUNITY</span><i /></div><h1>让好机会，<br /><em>随时看见你。</em></h1><p>把简历妥帖收好。需要的时候，<br className="mobile-only" />打开、打印或下载，一切刚刚好。</p></div><div className="intro-stamp"><span>YOUR STORY</span><strong>↗</strong><small>READY TO GO</small></div></div>

        {notice && <div className={`notice ${notice.kind}`} role="status"><span>{notice.kind === "success" ? <Check size={17} /> : <CircleHelp size={17} />}{notice.text}</span><button aria-label="关闭提示" onClick={() => setNotice(null)}><X size={16} /></button></div>}

        <div className="workspace-grid">
          <section className="left-column">
            <div className="section-heading"><div><span className="section-number">01 / UPLOAD</span><h2>收好你的简历<span>。</span></h2><p>一份准备，从容应对每一次机会。</p></div><span className="handwritten">Start here ↘</span></div>
            {user ? <div className={`upload-zone ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void upload(event.dataTransfer.files[0]); }}>
              <div className="upload-icon"><CloudUpload size={25} strokeWidth={1.5} /></div><h3>{uploading ? "正在收好你的简历…" : "拖放简历到这里"}</h3><p>或选择文件上传</p><button className="button primary" disabled={uploading} onClick={() => inputRef.current?.click()}><Plus size={17} />{uploading ? "上传中" : "选择 PDF 文件"}</button><input ref={inputRef} className="visually-hidden" type="file" accept="application/pdf,.pdf" aria-label="选择 PDF 简历" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void upload(file); }} /><div className="upload-meta"><span>PDF 格式</span><span>单个文件不超过 10 MB</span></div>
            </div> : <AuthPanel />}
            <div className="upload-tip"><span>✳</span><p><strong>小贴士</strong> PDF 能更好地保留简历原有排版，让不同设备看到的内容保持一致。</p></div>

            <div className="library-title"><div><span className="section-number">02 / YOUR LIBRARY</span><h2>我的简历 <span className="count">{resumes.length.toString().padStart(2, "0")}</span></h2></div><span className="library-hint">最近上传在前</span></div>
            {loading ? <div className="empty-list">正在读取你的简历…</div> : resumes.length === 0 ? <div className="empty-list"><FileText size={19} /><span>{user ? "还没有简历，上传第一份开始吧。" : "登录后，你的简历会出现在这里。"}</span></div> : <div className="resume-list">{resumes.map((resume) => <div className={`resume-row ${resume.id === selectedId ? "selected" : ""}`} key={resume.id}><button className="resume-select" onClick={() => chooseResume(resume.id)} aria-pressed={resume.id === selectedId}><span className="file-icon"><FileText size={19} /></span><span className="file-info"><strong>{resume.name}</strong><small>{formatDate(resume.uploadedAt)} <span>·</span> {formatSize(resume.size)}</small></span><ChevronRight className="row-chevron" size={17} /></button><button className="delete-button" title={`删除 ${resume.name}`} aria-label={`删除 ${resume.name}`} onClick={() => setPendingDelete(resume)}><Trash2 size={16} /></button></div>)}</div>}
          </section>

          <section className="preview-card" aria-label="简历预览"><div className="preview-header"><div><span className="section-number">YOUR PREVIEW / 预览</span><h2>{selected ? "准备就绪" : "你的故事，值得被看见"}<span>✳</span></h2></div>{selected ? <a className="preview-badge" href={`/api/resumes/${selected.id}`} target="_blank" rel="noopener noreferrer">放大查看 ↗</a> : <span className="preview-badge">示意</span>}</div><div className={`preview-stage ${selected ? "has-resume" : ""}`}>{selected ? <PdfPreview key={selected.id} url={`/api/resumes/${selected.id}`} onReady={setPrintReady} /> : <SampleResume />}</div><div className="preview-bottom"><div className="preview-filename"><span className="mini-file"><FileText size={17} /></span><div><strong>{selected?.name ?? "你的简历预览"}</strong><small>{selected ? `${formatSize(selected.size)} · 仅自己可见` : "上传文件后即可查看"}</small></div></div><div className="preview-actions"><button className="icon-action" disabled={!selected || !printReady} onClick={() => window.print()} title={selected && !printReady ? "正在准备预览" : "打印简历"}><Printer size={16} /><span>打印</span></button>{selected ? <a className="icon-action dark" href={`/api/resumes/${selected.id}?download=1`} download><ArrowDownToLine size={16} /><span>下载</span></a> : <button className="icon-action dark" disabled><ArrowDownToLine size={16} /><span>下载</span></button>}</div></div></section>
        </div>
        <div className="bottom-note"><span>KEEP YOUR STORY CLOSE.</span><p>为每一次新的开始，做好准备。 <span>✳</span></p><span>© RESUME POCKET</span></div>
      </div>
    </main>

    {pendingDelete && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setPendingDelete(null); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><div className="modal-icon"><Trash2 size={20} /></div><h2 id="delete-title">删除这份简历？</h2><p>“{pendingDelete.name}”将从你的空间中删除。这个操作无法撤销。</p><div className="modal-actions"><button className="button secondary" onClick={() => setPendingDelete(null)} disabled={deleting} autoFocus>再想想</button><button className="button danger" onClick={() => void removeResume()} disabled={deleting}>{deleting ? "删除中…" : "确认删除"}</button></div></div></div>}
  </div>;
}
