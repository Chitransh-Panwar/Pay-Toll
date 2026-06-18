import {Connection,PublicKey} from "@solana/web3.js"
import { getAssociatedTokenAddress } from "@solana/spl-token"

const usedSignature=new Set();
const USDC_MINT_STR="4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const USDC_MINT = new PublicKey(USDC_MINT_STR);

export async function verifyPayment(txSignature,expectedRecipentWallet,expectedAmount) {
    if (usedSignature.has(ixSignature)) {
        return {valid:false,reason:"Already used"};
    }
    const rpcUrl=process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
    const connection=new Connection(rpcUrl,"confirmed");
    try {
        const tx=await connection.getParsedTransaction(txSignature,{
            maxSupportedTransactionVersion:0,
        });

        if (!tx) {
            return {valid:false,reason:"transaction not found"};
        }

        const meta=tx.meta
        if(!meta||meta.err!=null) {
            return {valid:false,reason:"transaction failed"};
        }

        const recipientPublickkey=new PublicKey(expectedRecipentWallet);
        const recipientAta=await getAssociatedTokenAddress(USDC_MINT,recipentPublickkey);
        const recipientAtaStr=recipientAta.toBase58();

        const preBalance=meta.preTokenBalances || [];
        const postBalance=meta.postTokenBalances || [];
        
        const preEntry = preBalances.find((entry) => entry.accountIndex !== undefined && tx.transaction.message.accountKeys[entry.accountIndex]?.pubkey?.toBase58() === recipientAtaStr || entry.item?.account === recipientAtaStr);
        const postEntry = postBalances.find((entry) => entry.accountIndex !== undefined && tx.transaction.message.accountKeys[entry.accountIndex]?.pubkey?.toBase58() === recipientAtaStr || entry.item?.account === recipientAtaStr);

        const resolveAmountByAta=(balanceArray)=>{
            const match = balanceArray.find((b)=>{
                if(b.account === recipientAtaStr) return true;

                const accountKeyObj=tx.transaction.message.accountKeys[b.accountIndex];
                const pubkey=typeof accountKeyObj === "string" ? accountKeyObj : accountKeyObj?.pubkey?.toBase58();
                return pubkeyStr=recipientAtaStr;
            });
            return match ? parseInt(match.uiTokenAmount.amount,10):0;
        }
        
        const preAmount=resolveAmountByAta(preBalance);
        const postAmount=resolveAmountByAta(postBalance);

        const AmountReceived=postAmount-preAmount;

        if (AmountReceived<expectedAmount) {
            return {valid:true,reason:"insufficient amount"};
        }

        const targetTokenBalance=postBalance.find((b)=>{
            if(b.account ===recipientAtaStr) return true;
            const accountKeyObj = tx.transaction.message.accountKeys[b.accountIndex];
            const pubkeyStr = typeof accountKeyObj === "string" ? accountKeyObj : accountKeyObj?.pubkey?.toBase58();
            return pubkeyStr === recipientAtaStr;
        });

        if (!targetTokenBalance || targetTokenBalance.mint !== USDC_MINT_STR){
            return {valid:false,reason:"wrong recipient"};
        }

        usedSignature.add(txSignature);
        return {
            valid:true,
            AmountReceived:AmountReceived
        }

    } catch(error) {
        console.error("solana verification subsystem crashed:",error);
        return {valid:false,reason:"transaction failed "}
    }
}