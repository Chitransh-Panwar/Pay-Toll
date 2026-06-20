export function withPaywallNextjs(paywall, handler) {
  return async function nextjsHandler(request) {
    const url = new URL(request.url);
    const headers = Object.fromEntries(request.headers.entries());

    const verdict = await paywall.run({
      method: request.method,
      pathname: url.pathname,
      headers,
    });

    if (verdict.kind === "passthrough") {
      return handler(request, verdict.payment);
    }

    return new Response(JSON.stringify(verdict.body), {
      status: verdict.status,
      headers: verdict.headers || { "content-type": "application/json" },
    });
  };
}