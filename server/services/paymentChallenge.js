import crypto from 'crypto'
export function generateChallenge(walletAddress,amount,resource) {
    const secret = process.env.PAYWALL_CHALLENGE_SECRET;
    if (!secret) throw new Error('PAYWALL_CHALLENGE_SECRET not set');
    const issuedAt=Date.now();
    const TEN_MINUTES_MS=10*60*1000;
    const expiresAt=issuedAt+TEN_MINUTES_MS;
    const nonce=crypto.randomBytes(16).toString('hex');
    const basePayload={
        walletAddress,
        amount,
        resource,
        nonce,
        issuedAt,
        expiresAt
    }
    const dataToSign=JSON.stringify(basePayload);
    const sig=crypto.createHmac('sha256',secret).update(dataToSign).digest('hex');
    const fullTokenObject={
        ...basePayload,
        sig
    };
    const tokenString=JSON.stringify(fullTokenObject);
    const token= Buffer.from(tokenString).toString('base64');
    return{
        token,
        expiresAt
    };
}

export function verifyChallenge(token) {
    const secret = process.env.PAYWALL_CHALLENGE_SECRET;
    if (!secret) throw new Error('PAYWALL_CHALLENGE_SECRET not set');
    try {
        if (!token || typeof token !== 'string') {
            return {valid:false,reason:"malformed"}
        }
        const decodedString=Buffer.from(token,'base64').toString('utf8');
        const parsedToken=JSON.parse(decodedString);
        const {sig,walletAddress,amount,resource,nonce,issuedAt,expiresAt} = parsedToken;
        if (!sig || !walletAddress || amount ===undefined ||!resource || !nonce ||!issuedAt ||  !expiresAt) {
            return {valid:false,reason:"malformed"}
        }
        if(Date.now()>expiresAt) {
            return {valid:false,reason:"expired"}
        }
        const basePayload={
            walletAddress,
            amount,
            resource,
            nonce,
            issuedAt,
            expiresAt,
        }

        const dataToSign=JSON.stringify(basePayload);
        const expectedsig=crypto.createHmac('sha256',secret).update(dataToSign).digest('hex');
        const abuf=Buffer.from(sig,'utf8');
        const bbuf=Buffer.from(expectedsig,'utf8');

        if (abuf.length !== bbuf.length ||!crypto.timingSafeEqual(abuf,bbuf)) {
            return {valid:false,reason:"Invalid Signature"}
        }

        return {
            valid:true,
            payload:basePayload
        };
    } catch(error) {
        return {valid:false,reason:"malformed"}
    }
}