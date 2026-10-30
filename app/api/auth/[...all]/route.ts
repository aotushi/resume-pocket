import { getAuth } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export function GET(request: Request) { return getAuth().handler(request); }
export async function POST(request: Request) {
  let sendFailed = false;
  const response = await getAuth(() => { sendFailed = true; }).handler(request);
  if (sendFailed) return Response.json({ code: "OTP_SEND_FAILED", message: "验证码邮件发送失败，请稍后重试" }, { status: 503 });
  return response;
}
