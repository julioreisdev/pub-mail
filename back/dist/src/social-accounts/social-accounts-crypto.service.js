"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialAccountsCryptoService = void 0;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
let SocialAccountsCryptoService = class SocialAccountsCryptoService {
    buildKey() {
        const secret = process.env.SOCIAL_ACCOUNTS_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET;
        if (!secret)
            return null;
        return crypto.createHash('sha256').update(secret).digest();
    }
    encrypt(value) {
        const key = this.buildKey();
        if (!key) {
            throw new Error('SOCIAL_ACCOUNTS_ENCRYPTION_KEY (ou JWT_ACCESS_SECRET) não está configurado.');
        }
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
    }
    decrypt(value) {
        const key = this.buildKey();
        if (!key) {
            throw new Error('SOCIAL_ACCOUNTS_ENCRYPTION_KEY (ou JWT_ACCESS_SECRET) não está configurado.');
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
};
exports.SocialAccountsCryptoService = SocialAccountsCryptoService;
exports.SocialAccountsCryptoService = SocialAccountsCryptoService = __decorate([
    (0, common_1.Injectable)()
], SocialAccountsCryptoService);
//# sourceMappingURL=social-accounts-crypto.service.js.map