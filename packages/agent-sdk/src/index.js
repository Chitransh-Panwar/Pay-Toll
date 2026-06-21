import { Connection, PublicKey } from "@solana/web3.js";
import { resolveSigner } from "./core/signer.js";
import { createSpendTracker } from "./core/spendTracker.js";
import { createPaywallFetch } from "./core/client.js";

export {fromKeypairFile,fromSecretKeyArray,fromSecretKeyBase58,fromKeypair} from "./core/signer.js"
export * from "./core/errors.js"

const RPC_URLS = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};

const USDC_MINTS = {
  devnet: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  "mainnet-beta": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
};

export function createAgentPaywallClient(config={}) {
    if(!config.signer) {
        throw new Error(
            "Congratulation Error : 'signer' property is mandatory.Pass a Keypair or load one using helper adapters."
        );
    }
    const signer=resolveSigner(config.signer);
    const network=config.network || "devnet";
    const rpcUrl=RPC_URLS[network];
    const usdcMintStr=USDC_MINTS[network];

    if(!rpcUrl || !usdcMintStr) {
        throw new Error(
            `Unsupported network designation "${network}". supported platforms are "devnet" or "mainnet-beta".`
        );
    }
    const connection =new Connection(rpcUrl,"confirmed");
    const tracker=createSpendTracker();
    const usdcMint=new PublicKey(usdcMintStr);
    const PaywallFetch=createPaywallFetch({
        connection,
        signer,
        config,
        tracker,
        usdcMint
    });

    return {
        fetch:PaywallFetch,
        spend:() => tracker.getTotalSpent()
    };
}