import { PublicKey,Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress,createTransferInstruction } from "@solana/spl-token";


export async function payChallenge({connection,signer,payTo,amountMicroUsdc,usdcMint}) {
    try {
        const recipientPublickey=new PublicKey(payTo);
        const sourceAta=await getAssociatedTokenAddress(usdcMint,signer.publicKey);
        const destinationAta=await getAssociatedTokenAddress(usdcMint,recipientPublickey);
        const transferIx=createTransferInstruction(
            sourceAta,
            destinationAta,
            signer.publicKey,
            amountMicroUsdc
        );
        const tx=new Transaction().add(transferIx);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash=blockhash;
        tx.feePayer=signer.publicKey;

        const signedTx=await signer.signTransaction(tx);
        const rawTx=signedTx.serialize();
        const signature =await connection.sendRawTransaction(rawTx,{
            skipPreflight:false,
            preflightCommitment:"confirmed",
        });
        await connection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            "confirmed"
        );
        return {signature};
    } catch (error) {
        throw new Error(`solana on-chain. payment execution failed : ${error.message}`);
    }
}