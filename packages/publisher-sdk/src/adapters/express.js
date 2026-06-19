export function expressMiddleware(paywall, overrides = {}) {
  return async function (req, res, next) {
    try {
      const verdict = await paywall.run({
        method: req.method,
        pathname: req.originalUrl?.split("?")[0] || req.path,
        headers: req.headers,
      });

      if (verdict.kind === "passthrough") {
        if (verdict.payment) req.paywallPayment = verdict.payment;
        return next();
      }

      return res.status(verdict.status).json(verdict.body);
    } catch (err) {
      next(err);
    }
    void overrides;
  };
}