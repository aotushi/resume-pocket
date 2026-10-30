"use client";

/**
 * 登录/注册弹窗。
 * 首页任何位置通过 useAuthDialog().open("signin" | "signup") 打开；
 * 访问 /app 未登录时会被重定向到 /?auth=signin&next=/app，这里读取参数自动弹出，成功后回到 next。
 */
import { createContext, useCallback, useContext, useState, useSyncExternalStore } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Mode = "signin" | "signup";
type Ctx = { open: (mode?: Mode) => void };

const AuthDialogContext = createContext<Ctx | null>(null);

export function useAuthDialog() {
  const ctx = useContext(AuthDialogContext);
  if (!ctx) throw new Error("useAuthDialog must be used inside AuthDialogProvider");
  return ctx;
}

// 只接受站内相对路径，防止开放重定向
function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/app";
}

const subscribeNothing = () => () => {};

export function AuthDialogProvider({ children }: { children: React.ReactNode }) {
  // 手动打开时的状态；URL 带 ?auth= 时由参数派生，用户关闭后不再自动弹出
  const [manual, setManual] = useState<Mode | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // 服务端渲染时没有 URL 参数，客户端水合后读取 location.search
  const searchParams = new URLSearchParams(useSyncExternalStore(subscribeNothing, () => window.location.search, () => ""));
  const requested = searchParams.get("auth");
  const fromUrl = !dismissed && (requested === "signin" || requested === "signup") ? requested : null;
  const isOpen = Boolean(manual ?? fromUrl);
  const mode = manual ?? fromUrl ?? "signin";
  const next = fromUrl ? safeNext(searchParams.get("next")) : "/app";

  const open = useCallback((value: Mode = "signin") => setManual(value), []);

  function onOpenChange(value: boolean) {
    if (value) return;
    setManual(null); setDismissed(true);
    // 关闭后清掉 URL 上的 auth 参数，避免刷新再次弹出
    const url = new URL(window.location.href);
    url.searchParams.delete("auth"); url.searchParams.delete("next");
    window.history.replaceState(null, "", url);
  }

  return <AuthDialogContext.Provider value={{ open }}>
    {children}
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-[420px]">
        <AuthForm mode={mode} onModeChange={setManual} next={next} />
      </DialogContent>
    </Dialog>
  </AuthDialogContext.Provider>;
}

function AuthForm({ mode, onModeChange, next }: { mode: Mode; onModeChange: (mode: Mode) => void; next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isSignin = mode === "signin";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/auth/${isSignin ? "sign-in" : "sign-up"}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, ...(isSignin ? {} : { name: email.trim().split("@")[0] }) }),
      });
      if (!response.ok) {
        if (response.status === 429) throw new Error("请求过于频繁，请稍后再试");
        throw new Error(isSignin ? "邮箱或密码不正确，请重试" : "注册未成功，请检查邮箱和密码，或尝试登录已有账号");
      }
      window.location.assign(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "暂时无法连接，请稍后再试");
      setBusy(false);
    }
  }

  return <form onSubmit={submit}>
    <DialogHeader className="items-center gap-3 border-b px-6 pt-7 pb-5 text-center sm:text-center">
      <span className="grid size-11 place-items-center rounded-full bg-secondary text-primary"><LockKeyhole className="size-5" /></span>
      <div className="space-y-1.5">
        <DialogTitle className="text-xl">{isSignin ? "登录简历口袋" : "创建你的账号"}</DialogTitle>
        <DialogDescription>{isSignin ? "登录后管理你的简历" : "注册后即可上传并在多设备访问简历"}</DialogDescription>
      </div>
    </DialogHeader>

    <div className="space-y-5 px-6 py-6">
      <Tabs value={mode} onValueChange={(value) => { onModeChange(value as Mode); setError(""); }}>
        <TabsList className="grid h-10 w-full grid-cols-2">
          <TabsTrigger value="signin">登录</TabsTrigger>
          <TabsTrigger value="signup">注册</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        <Label htmlFor="auth-email">邮箱</Label>
        <Input id="auth-email" className="h-11" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="you@example.com" maxLength={254} autoFocus />
      </div>
      <div className="space-y-2">
        <Label htmlFor="auth-password">密码</Label>
        <div className="relative">
          <Input id="auth-password" className="h-11 pr-11" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={10} maxLength={128} autoComplete={isSignin ? "current-password" : "new-password"} placeholder="至少 10 个字符" aria-describedby="auth-password-hint" />
          <button type="button" className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "隐藏密码" : "显示密码"}>
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <p id="auth-password-hint" className="text-xs leading-relaxed text-muted-foreground">
          {isSignin ? "暂不支持找回密码，请妥善保管" : "密码 10–128 个字符，暂不支持邮箱找回，请妥善保管"}
        </p>
      </div>

      {error && <p className="rounded-md bg-destructive/8 px-3 py-2.5 text-sm text-destructive" role="alert">{error}</p>}

      <Button type="submit" size="lg" className="h-11 w-full text-[15px]" disabled={busy}>
        {busy && <Spinner />}{busy ? "请稍等…" : isSignin ? "登录" : "创建账号"}
      </Button>

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        继续即表示你同意<a className="text-primary underline-offset-4 hover:underline" href="/terms">服务说明</a>和<a className="text-primary underline-offset-4 hover:underline" href="/privacy">隐私说明</a>
      </p>
    </div>
  </form>;
}

/** 首页里任意位置打开弹窗的按钮 */
export function AuthButton({ mode = "signin", children, onClick, ...props }: { mode?: Mode } & React.ComponentProps<typeof Button>) {
  const { open } = useAuthDialog();
  // 保留外部 onClick（例如 SheetClose 注入的关闭菜单）
  return <Button {...props} onClick={(event) => { onClick?.(event); open(mode); }}>{children}</Button>;
}
