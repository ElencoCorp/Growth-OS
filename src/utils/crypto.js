const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey() {
    const secret = process.env.ENCRYPTION_KEY || 'default-insecure-key-do-not-use-in-prod';
    return crypto.scryptSync(secret, 'salt', KEY_LENGTH);
}

function encrypt(text) {
    if (!text) return text;
    
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Return iv:tag:encrypted
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

function decrypt(hash) {
    if (!hash || typeof hash !== 'string' || !hash.includes(':')) return hash;
    
    try {
        const parts = hash.split(':');
        if (parts.length !== 3) return hash; // might not be encrypted
        
        const iv = Buffer.from(parts[0], 'hex');
        const tag = Buffer.from(parts[1], 'hex');
        const encryptedText = parts[2];
        
        const key = getEncryptionKey();
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('[Crypto Error] Failed to decrypt string.', error.message);
        return null;
    }
}

module.exports = {
    encrypt,
    decrypt
};
