import { useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { IconForms, IconPencil } from '@tabler/icons-react';

import { TgCard } from 'views/pages/telegram/ui';
import CustomFieldsEditor from '../crm/CustomFieldsEditor';
import { CF_ENTITIES, useCrmSettings } from '../crm/customFields';
import { SettingsCardHeader, cardSx } from './settingsKit';

// ============================================================================
// Card "Campos personalizados" (Fase 7) em WhatsApp → Configurações: quantos campos cada
// cadastro tem + botão que abre o editor por entidade (o mesmo da tela Clientes).
// ============================================================================
export default function CustomFieldsCard({ canEdit }) {
  const { settings } = useCrmSettings();
  const [open, setOpen] = useState(false);
  const map = settings?.custom_fields || {};
  const total = CF_ENTITIES.reduce((n, e) => n + (map[e.key]?.length || 0), 0);
  return (
    <TgCard hover={false} sx={cardSx}>
      <SettingsCardHeader
        icon={IconForms}
        title="Campos personalizados"
        subtitle="Campos próprios do seu negócio em clientes, produtos, assinaturas, cobranças, chamados, agendamentos e pedidos"
        stackAction
        action={
          canEdit ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<IconPencil size={15} />}
              onClick={() => setOpen(true)}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
            >
              Editar campos
            </Button>
          ) : null
        }
      />
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
        {CF_ENTITIES.map((e) => {
          const n = map[e.key]?.length || 0;
          return (
            <Chip
              key={e.key}
              size="small"
              variant={n ? 'filled' : 'outlined'}
              color={n ? 'success' : 'default'}
              label={`${e.label}: ${n}`}
              sx={{ fontWeight: 700, borderRadius: 1.5 }}
            />
          );
        })}
      </Stack>
      <Box sx={{ flex: 1 }} />
      <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1.5 }}>
        {total
          ? 'Os campos aparecem nos formulários e nos detalhes; os marcados com "Pedir no bot" são perguntados pelo bot.'
          : 'Nenhum campo ainda. Ex.: "Nº do contrato", "Placa do veículo", "Convênio", "Ponto de referência".'}
      </Typography>
      {canEdit ? <CustomFieldsEditor open={open} onClose={() => setOpen(false)} /> : null}
    </TgCard>
  );
}
