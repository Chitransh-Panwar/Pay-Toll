import { payChallenge } from "./payment.js";
import { checkAmountLimit,checkBudgetLimit } from "./guards.js";
import { PaywallParseError } from "./errors.js";

const DEFAULT_USDC_MINT="4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export function createPaywallFetch({connection,signer,config={},tracker,usdcMint=DEFAULT_USDC_MINT}) {
    return async function PaywallFetch(url,options={}) {
        let res =await fetch(url,options);
        if(res.status !== 402) {
            return res;
        }
        let envelope;
        try{
            envelope=await res.json();
        } catch {
            throw new PaywallParseError("Failed to parse 402 response status body layout as JSON.");
        }
        const {payTo,amount,challenge}=envelope || {};
        if(!payTo || amount===undefined || amount===null || !challenge) {
            throw new PaywallParseError(
                `Malformed 402 response payload received .Missing critical target execution data (payTo,amount, or challenge ).`
            );
        }
        const amountMicroUsdc=Number(amount);
        checkAmountLimit(amountMicroUsdc,config.maxAmountMicroUsdc);
        const key=`${url}:${challenge}`;
        let paymentPromise =tracker.getInFlight(key);
        if(!paymentPromise) {
            checkBudgetLimit(tracker.getTotalSpent(),amountMicroUsdc,config.maxTotalMicroUsdc);
            tracker.reservePendingSpend(amountMicroUsdc);
            paymentPromise=payChallenge({
                connection,
                signer,
                payTo,
                amountMicroUsdc,
                usdcMint
            }).then((result)=>{
                if(typeof tracker.commitSpent === "function") {
                    tracker.commitSpent(amountMicroUsdc);
                } else {
                    tracker.recordSpend(amountMicroUsdc);
                } 
                return result;
            }).catch((err)=>{
                tracker.rollbackPendingSpend(amountMicroUsdc);
                throw err;
            });

            tracker.setInFlight(key,paymentPromise);
            paymentPromise.finally(()=>tracker.clearInFlight(key));
        }
        const {signature} = await paymentPromise;
        const retryHeaders={
            ...(options.headers || {}),
            "x-payment":signature,
            "x-paywall-challenge":challenge,
        };
        res=await fetch(url,{
            ...options,
            headers:retryHeaders
        });

        res.paywallPayment={
            signature,
            amountMicroUsdc
        };

        return res;
    };
}