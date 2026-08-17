import crypto from 'node:crypto';
export function verifyMetaSignature(raw:Buffer,header:string|null,secret:string){if(!header?.startsWith('sha256='))return false;const expected='sha256='+crypto.createHmac('sha256',secret).update(raw).digest('hex');return expected.length===header.length&&crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(header))}
