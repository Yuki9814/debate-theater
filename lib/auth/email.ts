import { AppError } from "../errors.ts";

export type LoginLinkEmailInput = {
  to: string;
  name?: string | null;
  verificationUrl: string;
  expiresAt: Date;
};

export type EmailReadiness = {
  provider: string;
  configured: boolean;
  deliveryEnabled: boolean;
};

function configured(value: string | undefined) {
  return Boolean(value?.trim());
}

function emailProvider() {
  return (process.env.EMAIL_PROVIDER || "").trim().toLowerCase();
}

export function canExposeLoginUrl() {
  return process.env.NODE_ENV !== "production" && process.env.AUTH_EXPOSE_LOGIN_URL !== "false";
}

export function getEmailReadiness(): EmailReadiness {
  const provider = emailProvider();
  if (provider === "resend") {
    const ready = configured(process.env.RESEND_API_KEY) && configured(process.env.EMAIL_FROM);
    return { provider, configured: ready, deliveryEnabled: ready };
  }
  if (provider === "log") {
    return {
      provider,
      configured: process.env.NODE_ENV !== "production",
      deliveryEnabled: process.env.NODE_ENV !== "production",
    };
  }
  return {
    provider: provider || "none",
    configured: false,
    deliveryEnabled: false,
  };
}

function messageBody(input: LoginLinkEmailInput) {
  const displayName = input.name?.trim() || input.to;
  return [
    `${displayName}，`,
    "",
    "论衡剧场登录链接如下，15 分钟内有效：",
    input.verificationUrl,
    "",
    "若非本人操作，可忽略此邮件。",
  ].join("\n");
}

export async function sendLoginLinkEmail(input: LoginLinkEmailInput) {
  const readiness = getEmailReadiness();

  if (readiness.provider === "resend") {
    if (!readiness.configured) {
      throw new AppError("邮件服务未配置。", 503, "EMAIL_NOT_CONFIGURED");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY?.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM?.trim(),
        to: [input.to],
        subject: "论衡剧场登录链接",
        text: messageBody(input),
      }),
    });

    if (!response.ok) {
      throw new AppError("邮件发送失败，请稍后再试。", 503, "EMAIL_SEND_FAILED");
    }
    return { sent: true, provider: readiness.provider };
  }

  if (process.env.NODE_ENV === "production") {
    throw new AppError("邮件服务未配置。", 503, "EMAIL_NOT_CONFIGURED");
  }

  if (readiness.provider === "log") {
    console.info("Local login link", {
      to: input.to,
      expiresAt: input.expiresAt.toISOString(),
      verificationUrl: input.verificationUrl,
    });
  }

  return { sent: false, provider: readiness.provider };
}
