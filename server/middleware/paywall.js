import { generateChallenge,verifyChallenge } from "../services/paymentChallenge.js";

export function paywallmiddleware(req,res,next) {
    const challengeHeader=req.headers["x-paywall-challenge"];
    if(challengeHeader) {
        const verification=verifyChallenge(challengeHeader);
        if(!verification.valid) {
            return res.status(401).json({
                error:"Unauthorized",
                reason:verification.reason
            });
        }
        req.paywallVerified=true;
        req.paywallPayment=verification.payload;

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