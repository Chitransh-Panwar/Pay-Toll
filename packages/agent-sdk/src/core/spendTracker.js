export function createSpendTracker() {
    let committedSpent=0;
    let pendingSpent=0;
    const inFlight=new Map();
    return {
        getTotalSpent() {
            return committedSpent + pendingSpent;
        },
        getCommittedSpent() {
            return committedSpent;
        },
        reservePendingSpend(amountMicroUsdc) {
            if(typeof amountMicroUsdc !== "number" || amountMicroUsdc <= 0) return ;
            pendingSpent +=amountMicroUsdc
        },
        commitSpent(amountMicroUsdc) {
            if(typeof amountMicroUsdc !== "number" || amountMicroUsdc <=0 ) return ;
            pendingSpent=Math.max(0,pendingSpent-amountMicroUsdc);
            committedSpent+=amountMicroUsdc;
        },
        rollbackPendingSpend(amountMicroUsdc) {
            if(typeof amountMicroUsdc !== "number" || amountMicroUsdc <= 0) return ;
            pendingSpent = Math.max(0,pendingSpent-amountMicroUsdc);
        },
        recordSpend(amountMicroUsdc) {
            if(typeof amountMicroUsdc !== "number" || amountMicroUsdc <= 0) return ;
            committedSpent+=amountMicroUsdc;
        },
        getInFlight(key) {
            return inFlight.get(key);
        },
        setInFlight(key,promise) {
            if(!key || !(promise instanceof Promise)) return;
            inFlight.set(key,promise);
        },
        clearInFlight(key) {
            inFlight.delete(key);
        }
    };
}