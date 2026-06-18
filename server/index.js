import express from "express";
import "dotenv/config"
import { aiDetector,initializeDatacenterRanges } from "./middleware/botdetecter.js";
import { paywallmiddleware } from "./middleware/paywall.js";

const app=express();
await initializeDatacenterRanges()
app.use(aiDetector)
app.use(paywallmiddleware)
app.get("/articles/test", (req, res) => {
  if (req.paywallVerified) {
    return res.json({
      content: "Here is your article.",
      paid: true,
      sig: req.paywallPayment?.signature
    });
  }
  res.json({ content: "Here is your article.", paid: false });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
