import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class SocialAccountsCryptoService {
  private buildKey() {
    const secret =
      process.env.SOCIAL_ACCOUNTS_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET;

    if (!secret) return null;

    return crypto.createHash('sha256').update(secret).digest();
  }

  encrypt(value: string): string {
    const key = this.buildKey();
    if (!key) {
      throw new Error(
        'SOCIAL_ACCOUNTS_ENCRYPTION_KEY (ou JWT_ACCESS_SECRET) não está configurado.',
      );
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
  }

  decrypt(value: string): string {
    const key = this.buildKey();
    if (!key) {
      throw new Error(
        'SOCIAL_ACCOUNTS_ENCRYPTION_KEY (ou JWT_ACCESS_SECRET) não está configurado.',
      );
    }

    const [ivB64, tagB64, dataB64] = String(value || '').split('.');
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error('Formato de token criptografado inválido.');
    }

    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const encrypted = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);

    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
