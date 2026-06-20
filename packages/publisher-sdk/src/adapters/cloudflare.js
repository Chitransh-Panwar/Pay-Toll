export async function cloudflareHandler(paywall, request, originHandler) {
  const url = new URL(request.url);
  const headers = Object.fromEntries(request.headers.entries());

  const verdict = await paywall.run({
    method: request.method,
    pathname: url.pathname,
    headers,
  });

  if (verdict.kind === "passthrough") {
    return originHandler(request, verdict.payment);
  }

  return new Response(JSON.stringify(verdict.body), {
    status: verdict.status,
    headers: verdict.headers || { "content-type": "application/json" },
  });
}

export function withPaywall(paywall, originHandler) {
  return async function paywallFetch(request, env, ctx) {
    return cloudflareHandler(
      paywall,
      request,
      (req, payment) => originHandler(req, env, ctx, payment),
    );
  };
}