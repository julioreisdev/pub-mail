import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';

const AI_PROVIDERS: { key: string; label: string }[] = [
  { key: 'groq_api_keys', label: 'Groq' },
  { key: 'cerebras_api_keys', label: 'Cerebras' },
  { key: 'gemini_api_keys', label: 'Gemini' },
  { key: 'mistral_api_keys', label: 'Mistral' },
  { key: 'openrouter_api_keys', label: 'OpenRouter' },
  { key: 'sambanova_api_keys', label: 'SambaNova' },
];

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettings: SystemSettingsService,
  ) {}

  // Visão geral do dashboard (contadores org-scoped + integrações de IA da plataforma).
  async overview(organizationId: string) {
    const where = { organization_id: organizationId };

    const [emailProjects, agents, webchats, quizzes, leads] = await Promise.all([
      this.prisma.email_projects.count({ where }),
      this.prisma.agentes_ia.count({ where }),
      this.prisma.webchats.count({ where }),
      this.prisma.quizzes.count({ where }),
      this.prisma.email_leads.count({ where }),
    ]);

    // Integrações de IA = provedores com pelo menos 1 chave cadastrada (singleton global).
    let providers = AI_PROVIDERS.map((p) => ({ key: p.key.replace('_api_keys', ''), label: p.label, count: 0 }));
    try {
      const settings: any = await this.systemSettings.get(organizationId);
      providers = AI_PROVIDERS.map((p) => ({
        key: p.key.replace('_api_keys', ''),
        label: p.label,
        count: this.systemSettings.parseKeys(settings?.[p.key]).length,
      }));
    } catch {
      /* se falhar, devolve provedores com count 0 */
    }
    const active = providers.filter((p) => p.count > 0);

    return {
      counts: {
        email_projects: emailProjects,
        agents,
        webchats,
        quizzes,
        leads,
      },
      ai_integrations: {
        connected: active.length,
        total: providers.length,
        providers,
      },
    };
  }
}
