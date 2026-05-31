export function getSafeCheckoutOrigin(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const headerOrigin = request.headers.get("origin");

  if (headerOrigin === requestOrigin) {
    return headerOrigin;
  }

  return requestOrigin;
}
