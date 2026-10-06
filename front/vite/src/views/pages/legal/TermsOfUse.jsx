import { useEffect } from 'react';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import LegalLayout, { LEGAL, Section } from './LegalLayout';

const P = ({ children }) => <Typography component="p">{children}</Typography>;

export default function TermsOfUse() {
  useEffect(() => {
    document.title = 'Termos de Uso — Pub Mail';
  }, []);
  return (
    <LegalLayout
      kicker="Termos"
      title="Termos de Uso"
      subtitle="Condições para contratar e usar a plataforma Pub Mail: WhatsApp, e-mail marketing, webchat com IA, Telegram, quizzes e plugin WordPress."
    >
      <Section title="1. Quem somos e o que é o Pub Mail">
        <P>
          O Pub Mail é uma plataforma on-line (software como serviço) para captação de leads, atendimento e vendas, oferecida no endereço{' '}
          {LEGAL.site} e nos domínios de cliente provisionados por ela. Ela é composta por módulos contratados separadamente ou em conjunto:
          WhatsApp (chat, bot, CRM, cobranças, broadcasts, status e agendamentos), e-mail marketing, webchat com IA, Telegram, quizzes e o
          plugin WordPress “Tradutor Invisível”.
        </P>
        <P>
          Ao criar uma conta, acessar o painel ou usar qualquer módulo, você (pessoa física ou jurídica, chamada aqui de “cliente” ou
          “você”) concorda com estes Termos e com a nossa Política de Privacidade. Se não concordar, não use a plataforma.
        </P>
      </Section>

      <Section title="2. Conta, organização e usuários">
        <ul>
          <li>
            O acesso é por organização (conta da empresa). O dono da organização pode criar usuários, definir quais módulos cada um acessa
            e, no WhatsApp, quais números cada usuário pode ver.
          </li>
          <li>
            Você é responsável por manter suas credenciais em sigilo e por tudo o que for feito com a sua conta. Avise-nos imediatamente em
            caso de uso não autorizado.
          </li>
          <li>As informações de cadastro devem ser verdadeiras e atualizadas. Contas criadas com dados falsos podem ser suspensas.</li>
          <li>O uso é permitido apenas a maiores de 18 anos ou a pessoas jurídicas representadas por quem tenha poderes para contratar.</li>
        </ul>
      </Section>

      <Section title="3. Planos, pagamento e renovação">
        <ul>
          <li>
            Os módulos são contratados por período (mensal ou anual) e pagos por PIX, com os preços publicados na página inicial no momento
            da contratação. Valores podem ser alterados para períodos futuros, sempre com aviso prévio no painel ou por e-mail.
          </li>
          <li>
            O período de acesso conta a partir da confirmação do pagamento. Não há renovação automática: ao fim do período, a plataforma
            avisa com antecedência e gera uma nova cobrança; sem pagamento, o acesso fica suspenso até a regularização.
          </li>
          <li>
            Enquanto a conta estiver suspensa, envios automáticos (broadcasts, agendamentos, bots, fluxos de e-mail) e páginas públicas
            (webchats e quizzes) ficam parados. Os dados são preservados pelo prazo descrito na Política de Privacidade.
          </li>
          <li>
            Não há reembolso proporcional por desistência no meio do período, salvo falha comprovada da plataforma que impeça o uso do
            módulo contratado por período relevante, caso em que o tempo é compensado.
          </li>
          <li>A compra do código-fonte é um contrato separado, com condições próprias acertadas por escrito.</li>
        </ul>
      </Section>

      <Section title="4. Uso aceitável">
        <P>
          Você se compromete a usar a plataforma apenas para fins lícitos e de acordo com as regras dos serviços envolvidos (WhatsApp,
          Telegram, provedores de e-mail, gateways de pagamento, Google, WordPress). É proibido:
        </P>
        <ul>
          <li>
            enviar mensagens ou e-mails sem base legal para o contato, spam, conteúdo enganoso, ofensivo, ilegal ou que viole direitos de
            terceiros;
          </li>
          <li>
            ignorar pedidos de descadastro (LGPD/opt-out) — a plataforma remove automaticamente dos envios em massa quem pede para sair, e
            você não deve contorná-la;
          </li>
          <li>usar a plataforma para golpes, phishing, venda de produtos proibidos ou coleta de dados sem consentimento;</li>
          <li>
            tentar burlar limites de envio, aquecimento de número, autenticação, isolamento entre organizações ou qualquer medida de
            segurança;
          </li>
          <li>
            revender, sublicenciar ou dar acesso a terceiros fora da sua organização sem contrato de código-fonte ou autorização escrita.
          </li>
        </ul>
        <P>
          Podemos suspender ou encerrar contas que violem esta seção, sem reembolso, e colaborar com autoridades quando exigido por lei.
        </P>
      </Section>

      <Section title="5. WhatsApp, Telegram e serviços de terceiros">
        <ul>
          <li>
            O módulo WhatsApp conecta números por meio de um cliente não oficial (sessão pareada por QR Code). O WhatsApp pode restringir ou
            banir números que façam envios em massa ou automação. A plataforma oferece aquecimento, limites diários e ritmos de envio
            “anti-bloqueio” para reduzir esse risco, mas <strong>a decisão é do WhatsApp e não temos como reverter</strong>. Recomendamos
            usar um número dedicado, não o pessoal. Ao desligar o limitador de envio você assume expressamente esse risco.
          </li>
          <li>
            Bots do Telegram, contas do Resend (e-mail), gateways de PIX (por exemplo, Mercado Pago), provedores de IA e o Google (tradução)
            são serviços de terceiros, com termos próprios. As chaves e tokens que você cadastra são da sua organização e de sua
            responsabilidade.
          </li>
          <li>Não somos responsáveis por indisponibilidade, mudanças de regras, tarifas ou bloqueios impostos por esses terceiros.</li>
        </ul>
      </Section>

      <Section title="6. Seus dados e os dados dos seus contatos">
        <ul>
          <li>
            Tudo o que você cadastra ou que chega pela plataforma (contatos, conversas, leads, mídias, clientes, cobranças) pertence a você.
            Nós apenas armazenamos e processamos esses dados para prestar o serviço, conforme a Política de Privacidade.
          </li>
          <li>
            Você é o controlador dos dados dos seus contatos e garante ter base legal para coletá-los e usá-los; o Pub Mail atua como
            operador. Você deve atender aos pedidos de titulares (acesso, correção, exclusão) e pode usar as ferramentas do painel para
            isso.
          </li>
          <li>
            Você pode exportar contatos e clientes em CSV a qualquer momento e apagar os dados de um número ou de toda a organização pelo
            painel.
          </li>
        </ul>
      </Section>

      <Section title="7. Propriedade intelectual">
        <P>
          O software, a marca Pub Mail, o layout, os textos e os componentes da plataforma são nossos ou licenciados para nós. A assinatura
          dá a você uma licença limitada, não exclusiva e intransferível de uso durante o período contratado. O plugin WordPress “Tradutor
          Invisível” é distribuído com licença vinculada à sua conta; alterar o código para contornar a verificação de licença não é
          permitido. A compra do código-fonte transfere os direitos descritos no contrato específico.
        </P>
      </Section>

      <Section title="8. Disponibilidade, suporte e mudanças">
        <ul>
          <li>
            Trabalhamos para manter a plataforma disponível de forma contínua, mas podem ocorrer manutenções, atualizações e falhas de
            terceiros. Avisamos sobre manutenções programadas quando possível.
          </li>
          <li>
            Fazemos backup diário dos dados e das sessões, com retenção limitada; mesmo assim, mantenha suas próprias exportações do que for
            crítico.
          </li>
          <li>
            Podemos adicionar, alterar ou descontinuar funcionalidades. Mudanças que reduzam de forma relevante um módulo contratado serão
            comunicadas com antecedência.
          </li>
          <li>
            O suporte é feito pelo WhatsApp {LEGAL.whatsapp} e pelo e-mail {LEGAL.email}, em dias úteis e horário comercial.
          </li>
        </ul>
      </Section>

      <Section title="9. Limitação de responsabilidade">
        <P>
          A plataforma é fornecida “como está”. Na máxima extensão permitida pela lei, não respondemos por lucros cessantes, perda de dados
          causada por terceiros, bloqueio de números ou contas por parte do WhatsApp, Telegram, provedores de e-mail ou gateways, nem por
          danos indiretos decorrentes do uso ou da impossibilidade de uso. Nossa responsabilidade total, em qualquer caso, fica limitada ao
          valor pago por você nos 12 meses anteriores ao evento.
        </P>
      </Section>

      <Section title="10. Encerramento">
        <P>
          Você pode encerrar sua conta a qualquer momento pelo suporte. Nós podemos encerrar ou suspender o acesso em caso de violação
          destes Termos, inadimplência ou exigência legal. Após o encerramento, os dados seguem o prazo de retenção da Política de
          Privacidade e depois são apagados.
        </P>
      </Section>

      <Section title="11. Alterações destes Termos">
        <P>
          Podemos atualizar estes Termos. A data da última atualização aparece no topo da página; mudanças relevantes serão avisadas no
          painel ou por e-mail. O uso continuado após a mudança significa concordância.
        </P>
      </Section>

      <Section title="12. Lei aplicável e contato">
        <P>
          Estes Termos são regidos pelas leis do Brasil. Fica eleito o foro do domicílio do consumidor, quando aplicável, ou, nos demais
          casos, o foro da comarca do prestador. Dúvidas: {LEGAL.email} ou{' '}
          <Link href={LEGAL.whatsappUrl} target="_blank" rel="noopener noreferrer">
            {LEGAL.whatsapp}
          </Link>
          .
        </P>
      </Section>
    </LegalLayout>
  );
}
