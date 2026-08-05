/**
 * Dev helper: print hybrid recipient + ML-DSA-65 issuer key hex for .env.local
 * Usage: node --import tsx packages/core/src/lib/crypto/print-dev-keys.ts
 */
import {
  generateHybridRecipientKeypair,
  generateMlDsa65Keypair,
} from "./index.js";

const hybrid = generateHybridRecipientKeypair();
const dsa = generateMlDsa65Keypair();

console.log("# Hybrid KEM recipient (MSGF_HYBRID_KEM_ENABLED=1)");
console.log(`MSGF_HYBRID_X25519_PUBLIC_KEY=${Buffer.from(hybrid.publicKeys.x25519PublicKey).toString("hex")}`);
console.log(`MSGF_HYBRID_X25519_SECRET_KEY=${Buffer.from(hybrid.secretKeys.x25519SecretKey).toString("hex")}`);
console.log(`MSGF_HYBRID_MLKEM_PUBLIC_KEY=${Buffer.from(hybrid.publicKeys.mlKem768PublicKey).toString("hex")}`);
console.log(`MSGF_HYBRID_MLKEM_SECRET_KEY=${Buffer.from(hybrid.secretKeys.mlKem768SecretKey).toString("hex")}`);
console.log("");
console.log("# HAL v2 ML-DSA-65 issuer (MSGF_HAL_PQC_SIGN=1)");
console.log(`MSGF_HAL_MLDSA_PUBLIC_KEY_ID=${dsa.publicKeyId}`);
console.log(`MSGF_HAL_MLDSA_PUBLIC_KEY=${Buffer.from(dsa.publicKey).toString("hex")}`);
console.log(`MSGF_HAL_MLDSA_SECRET_KEY=${Buffer.from(dsa.secretKey).toString("hex")}`);
