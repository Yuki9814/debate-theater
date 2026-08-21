import { randomUUID } from "node:crypto";
import { AppError } from "../errors.ts";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export function resolveRoundRequestId(request: Request): string {
  const supplied = request.headers.get("Idempotency-Key")?.trim();
  if (!supplied) return randomUUID();
  if (!IDEMPOTENCY_KEY_PATTERN.test(supplied)) {
    throw new AppError(
      "回合请求标识格式无效。请使用 8–128 位字母、数字、点、下划线、冒号或短横线。",
      400,
      "INVALID_IDEMPOTENCY_KEY",
    );
  }
  return supplied;
}
