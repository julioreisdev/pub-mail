import type { WaTemplate } from '../wa-template.types';
import { clinica } from './clinica';
import { provedor } from './provedor';
import { loja } from './loja';
import { seguranca } from './seguranca';
import { vip } from './vip';
import { prefeitura } from './prefeitura';
import { mercado } from './mercado';

// Registro dos modelos por ramo (Fase 7). Cada ramo num arquivo próprio desta pasta.
export const WA_TEMPLATES: WaTemplate[] = [clinica, provedor, loja, seguranca, vip, prefeitura, mercado];
