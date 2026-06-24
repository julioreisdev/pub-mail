import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateQuizAdsDto } from './dto/update-quiz-ads.dto';
import { normalizeAdContract } from './ads-normalize.util';

// Posições suportadas no back. A UI hoje só expõe "topo"; as demais já
// funcionam pra liberar no futuro sem migração.
const ADS_POSITIONS = ['topo', 'rodape', 'intersticial'] as const;
type AdsPosition = (typeof ADS_POSITIONS)[number];

@Injectable()
export class QuizAdsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureQuizInOrg(organizationId: string, quizId: string) {
    const quiz = await this.prisma.quizzes.findFirst({
      where: { id: quizId, organization_id: organizationId },
      select: { id: true },
    });
    if (!quiz) throw new NotFoundException('Quiz não encontrado.');
  }

  // Monta o config de ads (por posição) a partir das linhas do banco.
  // publicOnly: descarta posições com ativo=false (não vão pro front público).
  private formatRowsAsConfig(rowsRaw: unknown, publicOnly: boolean) {
    const rows = Array.isArray(rowsRaw) ? rowsRaw : [];
    const config: Record<string, any> = {};
    rows.forEach((rowRaw: any) => {
      const row = rowRaw && typeof rowRaw === 'object' ? rowRaw : {};
      const position = String(row.position ?? '').trim().toLowerCase();
      if (!ADS_POSITIONS.includes(position as AdsPosition)) return;
      const normalized = normalizeAdContract(row, position);
      if (!normalized) return;
      if (publicOnly && normalized.ativo === false) return;
      config[position] = normalized;
    });
    return config;
  }

  // Leitura crua (todas as posições, incl. inativas) — usada pela leitura
  // pública também, com publicOnly conforme o caller.
  async readAdsConfig(
    organizationId: string,
    quizId: string,
    publicOnly = false,
  ) {
    const rows = await (this.prisma as any).quiz_ads.findMany({
      where: { organization_id: organizationId, quiz_id: quizId },
      orderBy: { created_at: 'asc' },
    });
    return this.formatRowsAsConfig(rows, publicOnly);
  }

  // Para o dialog de configuração (mostra tudo, incl. inativos).
  async getAdsConfig(organizationId: string, quizId: string) {
    await this.ensureQuizInOrg(organizationId, quizId);
    return this.readAdsConfig(organizationId, quizId, false);
  }

  async updateAdsConfig(
    organizationId: string,
    quizId: string,
    payload: UpdateQuizAdsDto,
  ) {
    await this.ensureQuizInOrg(organizationId, quizId);

    const positions: AdsPosition[] = ['topo', 'rodape', 'intersticial'];

    await this.prisma.$transaction(async (tx) => {
      for (const position of positions) {
        const raw = (payload as any)?.[position];
        // Posição ausente no payload => não mexe.
        if (raw === undefined) continue;

        const normalized = normalizeAdContract(raw, position);

        if (!normalized) {
          // Sem conteúdo válido => remove a posição.
          await (tx as any).quiz_ads.deleteMany({
            where: {
              organization_id: organizationId,
              quiz_id: quizId,
              position,
            },
          });
          continue;
        }

        await (tx as any).quiz_ads.upsert({
          where: { quiz_id_position: { quiz_id: quizId, position } },
          update: {
            codigo_tag: normalized.codigo_tag,
            gpt_sizes: normalized.gpt_sizes,
            gpt_slot: normalized.gpt_slot ?? null,
            gpt_div_id: normalized.gpt_div_id ?? null,
            anuncio_fixed: normalized.anuncio_fixed ?? null,
            rotulo: normalized.rotulo ?? 'PUBLICIDADE',
            rotulo_ativo: normalized.rotuloAtivo !== false,
            ativo: normalized.ativo !== false,
          },
          create: {
            organization_id: organizationId,
            quiz_id: quizId,
            position,
            codigo_tag: normalized.codigo_tag,
            gpt_sizes: normalized.gpt_sizes,
            gpt_slot: normalized.gpt_slot ?? null,
            gpt_div_id: normalized.gpt_div_id ?? null,
            anuncio_fixed: normalized.anuncio_fixed ?? null,
            rotulo: normalized.rotulo ?? 'PUBLICIDADE',
            rotulo_ativo: normalized.rotuloAtivo !== false,
            ativo: normalized.ativo !== false,
          },
        });
      }
    });

    return this.readAdsConfig(organizationId, quizId, false);
  }
}
