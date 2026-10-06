import { useEffect } from 'react';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import LegalLayout, { LEGAL, Section } from './LegalLayout';

const P = ({ children }) => <Typography component="p">{children}</Typography>;

export default function PrivacyPolicy() {
  useEffect(() => {
    document.title = 'Política de Privacidade — Pub Mail';
  }, []);
  return (
    <LegalLayout
      kicker="Privacidade"
      title="Política de Privacidade"
      subtitle="Como o Pub Mail coleta, usa, guarda e protege os dados da sua organização e dos seus contatos, em conformidade com a LGPD (Lei 13.709/2018)."
    >
      <Section title="1. Papéis: quem é controlador e quem é operador">
        <ul>
          <li>
            Para os dados da sua conta (nome, e-mail, organização, pagamentos, registros de acesso), o Pub Mail é o{' '}
            <strong>controlador</strong>.
          </li>
          <li>
            Para os dados dos seus contatos, leads e clientes que passam pela plataforma (conversas de WhatsApp e Telegram, listas de
            e-mail, respostas de quizzes, leads de webchat, cadastro de clientes e cobranças), <strong>você é o controlador</strong> e o Pub
            Mail é o <strong>operador</strong>: tratamos esses dados só para prestar o serviço, conforme as suas instruções.
          </li>
        </ul>
      </Section>

      <Section title="2. Quais dados tratamos">
        <ul>
          <li>
            <strong>Conta:</strong> nome, e-mail, senha (guardada com hash), organização, módulos liberados, números de WhatsApp que cada
            usuário pode acessar, registros de login e de ações relevantes.
          </li>
          <li>
            <strong>Pagamentos:</strong> identificador da cobrança no gateway (PIX), valor, período e status. Não guardamos dados bancários
            ou de cartão.
          </li>
          <li>
            <strong>WhatsApp:</strong> sessão pareada do número (credenciais de conexão no gateway), contatos, conversas, mensagens, mídias
            recebidas e enviadas, status, etiquetas, atendimentos, clientes, cobranças, tarefas e notas internas.
          </li>
          <li>
            <strong>E-mail marketing:</strong> listas de leads (nome, e-mail, telefone, tags, atributos), templates, envios, aberturas,
            cliques, bounces e reclamações de spam.
          </li>
          <li>
            <strong>Webchat e quizzes:</strong> mensagens trocadas com o agente, leads captados (nome, e-mail, telefone), respostas,
            pagamentos PIX feitos pelo funil.
          </li>
          <li>
            <strong>Telegram:</strong> contatos e grupos dos seus bots, mensagens, pagamentos e assinaturas VIP.
          </li>
          <li>
            <strong>WordPress:</strong> domínio do site, versão do plugin e checagens de licença. Textos traduzidos ficam no site do
            cliente, não no Pub Mail.
          </li>
          <li>
            <strong>Chaves de integração:</strong> tokens de IA, Resend, Telegram e gateways de pagamento que você cadastra, guardados por
            organização e mostrados mascarados no painel.
          </li>
          <li>
            <strong>Técnicos:</strong> endereço IP, navegador e data/hora das requisições, usados para segurança e limites de uso.
          </li>
        </ul>
      </Section>

      <Section title="3. Para que usamos">
        <ul>
          <li>
            Prestar o serviço contratado: enviar e receber mensagens, e-mails e status, rodar bots, fluxos, cobranças e automações, mostrar
            métricas.
          </li>
          <li>Autenticar usuários, proteger a plataforma contra abuso, aplicar limites de envio e isolar os dados de cada organização.</li>
          <li>Cobrar e confirmar pagamentos, avisar sobre vencimento e renovação.</li>
          <li>Prestar suporte e comunicar mudanças importantes do serviço.</li>
          <li>Cumprir obrigações legais e atender ordens de autoridades.</li>
        </ul>
        <P>Não vendemos dados, não usamos os dados dos seus contatos para fins próprios e não treinamos modelos de IA com eles.</P>
      </Section>

      <Section title="4. Com quem compartilhamos">
        <P>Apenas com quem é necessário para o serviço funcionar, cada um sob seus próprios termos:</P>
        <ul>
          <li>
            <strong>WhatsApp e Telegram:</strong> para entregar e receber mensagens dos seus números e bots.
          </li>
          <li>
            <strong>Provedor de e-mail (Resend):</strong> para enviar e-mails e receber eventos de entrega, abertura, clique, bounce e spam.
          </li>
          <li>
            <strong>Gateways de pagamento (por exemplo, Mercado Pago):</strong> para gerar PIX e boletos e confirmar pagamentos.
          </li>
          <li>
            <strong>Provedores de IA</strong> (os que você cadastrar): recebem o conteúdo das conversas do webchat para gerar as respostas
            do agente.
          </li>
          <li>
            <strong>Google</strong> (plugin WordPress): recebe os textos do site para tradução.
          </li>
          <li>
            <strong>Infraestrutura de hospedagem</strong> dos servidores onde a plataforma roda.
          </li>
        </ul>
        <P>Os dados dos seus contatos nunca são compartilhados com outras organizações que usam o Pub Mail: cada conta é isolada.</P>
      </Section>

      <Section title="5. Por quanto tempo guardamos">
        <ul>
          <li>Mídias recebidas pelo WhatsApp: 90 dias (exceto as usadas em configurações, como respostas rápidas e fluxos do bot).</li>
          <li>
            Conversas, contatos, leads, clientes e métricas: enquanto a conta estiver ativa, ou até você apagar pelo painel (é possível
            limpar os dados de um número ou de toda a organização).
          </li>
          <li>
            Conta encerrada ou inadimplente: os dados ficam guardados por até 90 dias para eventual reativação e depois são apagados, salvo
            obrigação legal de retenção.
          </li>
          <li>Registros de pagamento: pelo prazo exigido pela legislação fiscal.</li>
          <li>Backups: cópias diárias com retenção curta (até 7 dias), apagadas automaticamente.</li>
        </ul>
      </Section>

      <Section title="6. Direitos dos titulares (LGPD)">
        <P>
          Você, como titular dos dados da sua conta, pode pedir confirmação de tratamento, acesso, correção, anonimização, portabilidade,
          exclusão e informações sobre compartilhamento, além de revogar consentimentos. Basta escrever para {LEGAL.email}. Respondemos em
          até 15 dias.
        </P>
        <P>
          Os seus contatos devem exercer esses direitos diretamente com você (controlador). A plataforma ajuda nisso: palavras de
          descadastro (por exemplo, “PARE” ou “SAIR”) tiram o contato automaticamente dos envios em massa, há link de descadastro em todo
          e-mail, e o painel permite exportar, corrigir e apagar dados de contatos e clientes.
        </P>
      </Section>

      <Section title="7. Segurança">
        <ul>
          <li>Tráfego sempre por HTTPS; senhas com hash forte; tokens de integração guardados por organização e exibidos mascarados.</li>
          <li>Isolamento por organização em todas as consultas; acesso por módulo e, no WhatsApp, por número para cada usuário.</li>
          <li>
            Webhooks de terceiros verificados por assinatura; limites de requisições por IP; arquivos de mídia servidos apenas por links
            assinados e temporários.
          </li>
          <li>
            Backups diários e monitoramento de falhas. Nenhum sistema é 100% seguro; em caso de incidente que afete seus dados, avisaremos
            você e, quando exigido, a ANPD.
          </li>
        </ul>
      </Section>

      <Section title="8. Cookies e armazenamento local">
        <P>
          O painel usa armazenamento local do navegador apenas para manter a sessão de login e preferências (tema, filtros, rascunhos). Não
          usamos cookies de publicidade nem rastreamento de terceiros no painel. Páginas públicas de webchat e quiz podem conter scripts de
          anúncios ou de medição configurados <em>por você</em> para o seu público; esses scripts seguem as políticas de quem os fornece.
        </P>
      </Section>

      <Section title="9. Transferência internacional">
        <P>
          Os servidores da plataforma ficam no Brasil. Alguns serviços de terceiros (WhatsApp, Telegram, Resend, provedores de IA, Google)
          podem processar dados fora do país, sob suas próprias garantias de proteção. Ao cadastrar uma integração, você autoriza essa
          transferência para o fim do serviço.
        </P>
      </Section>

      <Section title="10. Crianças e adolescentes">
        <P>
          A plataforma destina-se a empresas e profissionais maiores de 18 anos. Não coletamos intencionalmente dados de menores como
          usuários do painel.
        </P>
      </Section>

      <Section title="11. Mudanças nesta política e contato">
        <P>
          Podemos atualizar esta política; a data da versão vigente aparece no topo. Mudanças relevantes serão comunicadas no painel ou por
          e-mail.
        </P>
        <P>
          Encarregado de dados (DPO) e contato: {LEGAL.email} ·{' '}
          <Link href={LEGAL.whatsappUrl} target="_blank" rel="noopener noreferrer">
            {LEGAL.whatsapp}
          </Link>
          .
        </P>
      </Section>
    </LegalLayout>
  );
}
