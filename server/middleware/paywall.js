import { generateChallenge,verifyChallenge } from "../services/paymentChallenge.js";
import { verifyPayment } from "../services/verifyPayment.js";
export async function paywallmiddleware(req,res,next) {
    const challengeHeader=req.headers["x-paywall-challenge"];
    if(challengeHeader) {
        const verification=verifyChallenge(challengeHeader);
        if(!verification.valid) {
            return res.status(401).json({
                error:"Unauthorized",
                reason:verification.reason
            });
        }
        const txSignature=req.headers["x-payment"];
        if (!txSignature) {
            return res.status(402).json({
                error:"Payment signature. missing",
                reason:"include x-payment header with Solana tx signature "
            });
        }
        const {walletAddress,amount}=verification.payload;
        const paymentResult=await verifyPayment(txSignature,walletAddress,amount);
        if (!paymentResult.valid) {
            return res.status(402).json({
                error:"Payment verificationn failed",
                reason:paymentResult.reason
            });
        }
        req.paywallVerified=true;
        req.paywallPayment={
            ...verification.payload,
            txSignature,
            amountReceived:paymentResult.amountReceived
        };

        return next();
    }
    if (req.isAI === true ) {
        const publishWallet=process.env.SOLANA_WALLET_ADDRESS;
        if (!publishWallet) {
            console.error("wallet id missing ");
            return res.status(500).json({error:"Internal server error "})
        }
        const MICRO_USDC_AMOUNT=1000;
        const resource=req.path;
        try{
            const challengeData=generateChallenge(publishWallet,MICRO_USDC_AMOUNT,resource);
            return res.status(402).json({
                payTo:publishWallet,
                amount:MICRO_USDC_AMOUNT,
                currency:"USDC",
                network:"solana",
                challenge:challengeData.token,
                expiresAt:challengeData.expiresAt,
                resource:resource
            });
        } catch(error) {
            console.error("Paywall challenge generation failed:",error);
            return res.status(500).json({error:"failed to issue paywall challenge "})
        }
    }
    next();
}