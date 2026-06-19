import {Connection,PublicKey} from "@solana/web3.js"
import { getAssociatedTokenAddress } from "@solana/spl-token"
const USDC_MINT_STR="4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const USDC_MINT = new PublicKey(USDC_MINT_STR);
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
export async function verifyPayment(txSignature,expectedRecipientWallet,expectedAmount) {
    const {data:existing} = await supabase.from("verified_tx_cache").select("signature").eq("signature",txSignature).maybeSingle();
    if (existing) {
        return {valid:false,reason:"already used"}
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
        const recipientPublickey=new PublicKey(expectedRecipientWallet);
        const recipientAta=await getAssociatedTokenAddress(USDC_MINT,recipientPublickey);
        const recipientAtaStr=recipientAta.toBase58();
        const preBalance=meta.preTokenBalances || [];
        const postBalance=meta.postTokenBalances || [];
        const resolveAmountByAta=(balanceArray)=>{
            const match = balanceArray.find((b)=>{
                if(b.account === recipientAtaStr) return true;
                const accountKeyObj=tx.transaction.message.accountKeys[b.accountIndex];
                const pubkeyStr=typeof accountKeyObj === "string" ? accountKeyObj : accountKeyObj?.pubkey?.toBase58();
                return pubkeyStr===recipientAtaStr;
            });
            return match ? parseInt(match.uiTokenAmount.amount,10):0;
        }
        const preAmount=resolveAmountByAta(preBalance);
        const postAmount=resolveAmountByAta(postBalance);
        const AmountReceived=postAmount-preAmount;
        const targetTokenBalance=postBalance.find((b)=>{
            if(b.account ===recipientAtaStr) return true;
            const accountKeyObj = tx.transaction.message.accountKeys[b.accountIndex];
            const pubkeyStr = typeof accountKeyObj === "string" ? accountKeyObj : accountKeyObj?.pubkey?.toBase58();
            return pubkeyStr === recipientAtaStr;
        });
        if (!targetTokenBalance || targetTokenBalance.mint !== USDC_MINT_STR){
            return {valid:false,reason:"wrong recipient"};
        }
        if (AmountReceived<expectedAmount) {
            return {valid:false,reason:"insufficient amount"};
        }
        await supabase.from("verified_tx_cache").insert({
            signature:txSignature,
            wallet_address:expectedRecipientWallet,
            amount:expectedAmount,
            resource:"unknown",
        })

        
        return {
            valid:true,
            amountReceived:AmountReceived
        }
    } catch(error) {
        console.error("solana verification subsystem crashed:",error);
        return {valid:false,reason:"transaction failed "}
    }
}