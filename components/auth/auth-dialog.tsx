"use client";

/**
 * 登录/注册弹窗：邮箱验证码登录，新邮箱自动注册；也可用密码登录，忘记密码用验证码重置。
 * 首页任何位置通过 useAuthDialog().open("signin" | "signup") 打开；
 * 访问 /app 未登录时会被重定向到 /?auth=signin&next=/app，这里读取参数自动弹出，成功后回到 next。
 */
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

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
        <AuthForm key={mode} mode={mode} next={next} />
      </DialogContent>
    </Dialog>
  </AuthDialogContext.Provider>;
}

type Step = "code" | "password" | "reset";

const RESEND_SECONDS = 60;

const OTP_ERRORS: Record<string, string> = {
  INVALID_OTP: "验证码不正确，请检查后重试",
  OTP_EXPIRED: "验证码已过期，请重新获取",
  TOO_MANY_ATTEMPTS: "错误次数过多，请重新获取验证码",
  OTP_SEND_FAILED: "验证码邮件发送失败，请稍后重试",
};

async function postAuth(path: string, body: Record<string, unknown>, fallback: string) {
  const response = await fetch(`/api/auth/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (response.ok) return;
  if (response.status === 429) throw new Error("请求过于频繁，请稍后再试");
  const data = await response.json().catch(() => null) as { code?: string } | null;
  throw new Error(OTP_ERRORS[data?.code ?? ""] ?? fallback);
}

function AuthForm({ mode, next }: { mode: Mode; next: string }) {
  // 默认验证码登录（新邮箱自动注册）；已设密码的可切到密码登录，忘记密码走验证码重置
  const [step, setStep] = useState<Step>("code");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const normalized = email.trim().toLowerCase();
  // 发送后改了邮箱，需要重新获取验证码
  const codeSent = sentTo !== "" && sentTo === normalized;
  const needsCode = step !== "password";

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  function switchStep(value: Step) {
    setStep(value); setError(""); setCode(""); setSentTo(""); setCooldown(0); setPassword("");
  }

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "暂时无法连接，请稍后再试");
    }
    setBusy(false);
  }

  const sendCode = () => run(async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("请输入有效的邮箱地址");
    await postAuth("email-otp/send-verification-otp", { email: normalized, type: step === "reset" ? "forget-password" : "sign-in" }, "验证码发送失败，请稍后再试");
    setSentTo(normalized); setCode(""); setCooldown(RESEND_SECONDS);
  });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (needsCode && !codeSent) { void sendCode(); return; }
    void run(async () => {
      if (step === "code") {
        await postAuth("sign-in/email-otp", { email: normalized, otp: code, name: normalized.split("@")[0] }, "登录未成功，请重新获取验证码");
      } else if (step === "reset") {
        await postAuth("email-otp/reset-password", { email: normalized, otp: code, password }, "重置未成功，请确认该邮箱已注册");
        await postAuth("sign-in/email", { email: normalized, password }, "密码已重置，请用新密码登录");
      } else {
        await postAuth("sign-in/email", { email: normalized, password }, "邮箱或密码不正确，可改用验证码登录");
      }
      window.location.assign(next);
      // 跳转期间保持按钮忙碌
      await new Promise(() => {});
    });
  }

  const title = step === "reset" ? "重置密码" : mode === "signin" ? "登录简历口袋" : "开始使用简历口袋";
  const description = step === "reset" ? "向注册邮箱发送验证码，验证后设置新密码"
    : step === "password" ? "使用邮箱和密码登录"
    : "输入邮箱获取验证码，没有账号会自动注册";
  const submitLabel = needsCode && !codeSent ? "获取验证码" : step === "reset" ? "重置并登录" : "登录";

  return <form onSubmit={submit}>
    <DialogHeader className="items-center gap-3 border-b px-6 pt-7 pb-5 text-center sm:text-center">
      <span className="grid size-11 place-items-center rounded-full bg-secondary text-primary">{step === "code" ? <Mail className="size-5" /> : <LockKeyhole className="size-5" />}</span>
      <div className="space-y-1.5">
        <DialogTitle className="text-xl">{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </div>
    </DialogHeader>

    <div className="space-y-5 px-6 py-6">
      <div className="space-y-2">
        <Label htmlFor="auth-email">邮箱</Label>
        <Input id="auth-email" className="h-11" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="you@example.com" maxLength={254} autoFocus />
      </div>

      {needsCode && codeSent && <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor="auth-code">验证码</Label>
          <button type="button" className="text-xs text-primary underline-offset-4 hover:underline disabled:text-muted-foreground disabled:no-underline" onClick={() => void sendCode()} disabled={busy || cooldown > 0}>
            {cooldown > 0 ? `${cooldown} 秒后可重新发送` : "重新发送"}
          </button>
        </div>
        <InputOTP id="auth-code" maxLength={6} pattern="^[0-9]*$" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={setCode} aria-describedby="auth-code-hint" autoFocus>
          {/* 六个独立方框铺满整行，与上方邮箱框同高同圆角 */}
          <InputOTPGroup className="w-full gap-2">{[0, 1, 2, 3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} className="h-11 flex-1 rounded-md border text-lg font-semibold tabular-nums" />)}</InputOTPGroup>
        </InputOTP>
        <p id="auth-code-hint" className="text-xs leading-relaxed text-muted-foreground">验证码已发送至 {sentTo}，10 分钟内有效；没收到请查看垃圾邮件</p>
      </div>}

      {(step === "password" || (step === "reset" && codeSent)) && <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor="auth-password">{step === "reset" ? "新密码" : "密码"}</Label>
          {step === "password" && <button type="button" className="text-xs text-primary underline-offset-4 hover:underline" onClick={() => switchStep("reset")}>忘记密码？</button>}
        </div>
        <div className="relative">
          <Input id="auth-password" className="h-11 pr-11" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={10} maxLength={128} autoComplete={step === "reset" ? "new-password" : "current-password"} placeholder="至少 10 个字符" />
          <button type="button" className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "隐藏密码" : "显示密码"}>
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>}

      {error && <p className="rounded-md bg-destructive/8 px-3 py-2.5 text-sm text-destructive" role="alert">{error}</p>}

      <Button type="submit" size="lg" className="h-11 w-full text-[15px]" disabled={busy || (needsCode && codeSent && code.length < 6)}>
        {busy && <Spinner />}{busy ? "请稍等…" : submitLabel}
      </Button>

      <p className="text-center text-sm">
        {step === "code"
          ? <button type="button" className="text-primary underline-offset-4 hover:underline" onClick={() => switchStep("password")}>用密码登录</button>
          : <button type="button" className="text-primary underline-offset-4 hover:underline" onClick={() => switchStep("code")}>改用验证码登录</button>}
      </p>

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
