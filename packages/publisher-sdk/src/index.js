import { matchesProtectedRoute } from "./core/routematcher.js";
import { generateChallenge, verifyChallenge } from "../../../server/services/paymentChallenge.js";
import { verifyPayment } from "../../../server/services/verifyPayment.js";
import { aiDetector } from "../../../server/middleware/botdetecter.js";

/**
 * @typedef {object} PaywallConfig
 * @property {string} walletAddress           Solana wallet address that receives USDC payments.
 * @property {"devnet"|"mainnet-beta"|string} [network="devnet"] Solana network.
 * @property {Array<string>} protect          Path patterns to gate.
 * @property {number} [basePriceMicroUsdc=1000] Per-call price in microUSDC.
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function isLikelySolanaAddress(value) {
  if (typeof value !== "string") return false;
  if (value.length < 32 || value.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(value);
}

export function createPaywall(config = {}) {
  const {
    walletAddress,
    protect,
    basePriceMicroUsdc = 1000,
    network = "devnet",
  } = config;

  // validation
  if (!walletAddress || typeof walletAddress !== "string" || walletAddress.trim() === "") {
    throw new Error("createPaywall: 'walletAddress' is required");
  }
  if (!isLikelySolanaAddress(walletAddress)) {
    throw new Error(`createPaywall: walletAddress "${walletAddress}" is not a valid Solana address`);
  }
  if (!protect || !Array.isArray(protect) || protect.length === 0) {
    throw new Error("createPaywall: 'protect' must be a non-empty array of route patterns");
  }

  // core run function — framework agnostic
  async function run({ method, pathname, headers }) {

    // 1. route check — not a protected route, passthrough
    if (!matchesProtectedRoute(pathname, protect)) {
      return { kind: "passthrough", payment: null };
    }

    // 2. fake req object so we can reuse aiDetector
    const fakeReq = { headers, method, path: pathname, socket: {} };
    await new Promise((resolve) => aiDetector(fakeReq, {}, resolve));

    const challengeHeader = headers["x-paywall-challenge"];

    // 3. agent retrying after payment
    if (challengeHeader) {
      // verify challenge token
      const verification = verifyChallenge(challengeHeader);
      if (!verification.valid) {
        return {
          kind: "unauthorized",
          status: 401,
          body: { error: "Unauthorized", reason: verification.reason },
        };
      }

      // verify solana payment
      const txSignature = headers["x-payment"];
      if (!txSignature) {
        return {
          kind: "payment_required",
          status: 402,
          body: { error: "Payment signature missing", reason: "include x-payment header" },
        };
      }

      const { walletAddress: expectedWallet, amount } = verification.payload;
      const paymentResult = await verifyPayment(txSignature, expectedWallet, amount);

      if (!paymentResult.valid) {
        return {
          kind: "payment_required",
          status: 402,
          body: { error: "Payment verification failed", reason: paymentResult.reason },
        };
      }

      await supabase.from("payments").insert({
        tx:txSignature,
        wallet_address:expectedWallet,
        network:"devnet",
        path:pathname,
        lamports:amount
      });

      // all checks passed
      return {
        kind: "passthrough",
        payment: {
          ...verification.payload,
          txSignature,
          amountReceived: paymentResult.amountReceived,
        },
      };
    }

    // 4. bot detected — issue 402 challenge
    if (fakeReq.botDetection?.isBot) {
      const challengeData = generateChallenge(walletAddress, basePriceMicroUsdc, pathname);
      return {
        kind: "payment_required",
        status: 402,
        body: {
          payTo: walletAddress,
          amount: basePriceMicroUsdc,
          currency: "USDC",
          network,
          challenge: challengeData.token,
          expiresAt: challengeData.expiresAt,
          resource: pathname,
        },
      };
    }

    // 5. human on protected route — passthrough
    return { kind: "passthrough", payment: null };
  }

  return {
    walletAddress,
    protect,
    basePriceMicroUsdc,
    network,
    run,
  };
}