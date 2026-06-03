export function getSafeCheckoutOrigin(request: Request) {
  const configuredOrigin = process.env.APP_ORIGIN?.trim();
  if (configuredOrigin) return new URL(configuredOrigin).origin;

  const requestOrigin = new URL(request.url).origin;
  const headerOrigin = request.headers.get("origin");

  if (headerOrigin === requestOrigin) {
    return headerOrigin;
  }

  return requestOrigin;
}
