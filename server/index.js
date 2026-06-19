import express from "express";
import "dotenv/config";
import { createPaywall } from "../packages/publisher-sdk/src/index.js";
import { expressMiddleware } from "../packages/publisher-sdk/src/adapters/express.js";
import { initializeDatacenterRanges } from "./middleware/botdetecter.js";

const app = express();

await initializeDatacenterRanges();

const paywall = createPaywall({
  walletAddress: process.env.SOLANA_WALLET_ADDRESS,
  protect: ["/articles/*"],
  basePriceMicroUsdc: 1000,
  network: "devnet",
});

app.use(expressMiddleware(paywall));

app.get("/articles/test", (req, res) => {
  if (req.paywallVerified) {
    return res.json({
      content: "Here is your article.",
      paid: true,
      sig: req.paywallPayment?.txSignature,
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