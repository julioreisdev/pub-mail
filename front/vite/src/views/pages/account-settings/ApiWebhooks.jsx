import { useSearchParams } from 'react-router-dom';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { IconApi, IconBook, IconKey, IconWebhook } from '@tabler/icons-react';

import { useAuth } from 'contexts/AuthContext';
import { TgPageHeader } from '../telegram/ui';
import ApiDocsTab from './api-webhooks/ApiDocsTab';
import ApiKeysTab from './api-webhooks/ApiKeysTab';
import WebhooksTab from './api-webhooks/WebhooksTab';

// ============================================================================
// Configurações → API e Webhooks (Fase 5): chaves da API pública (/api/v1/whatsapp),
// webhooks de saída (eventos de clientes/assinaturas/cobranças/acessos) e a documentação.
// Criar/revogar/configurar: dono, admin ou superadmin (o back também confere).
// ============================================================================

const TABS = ['keys', 'webhooks', 'docs'];

export default function ApiWebhooks() {
  const { user } = useAuth();
  const canManage = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(user?.user?.role);
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'keys';
  const setTab = (v) =>
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (v === 'keys') n.delete('tab');
        else n.set('tab', v);
        return n;
      },
      { replace: true }
    );

  return (
    <Box>
      <TgPageHeader
        icon={IconApi}
        title="API e Webhooks"
        subtitle="Integre o seu sistema com os clientes, assinaturas e cobranças do WhatsApp — e receba os eventos na hora."
      />
      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{
          mb: 2,
          minHeight: 40,
          borderBottom: '1px solid',
          borderColor: 'divider',
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 40 }
        }}
      >
        <Tab value="keys" icon={<IconKey size={16} />} iconPosition="start" label="Chaves de API" />
        <Tab value="webhooks" icon={<IconWebhook size={16} />} iconPosition="start" label="Webhooks" />
        <Tab value="docs" icon={<IconBook size={16} />} iconPosition="start" label="Documentação" />
      </Tabs>
      {tab === 'keys' ? <ApiKeysTab canManage={canManage} /> : null}
      {tab === 'webhooks' ? <WebhooksTab canManage={canManage} /> : null}
      {tab === 'docs' ? <ApiDocsTab /> : null}
    </Box>
  );
}
