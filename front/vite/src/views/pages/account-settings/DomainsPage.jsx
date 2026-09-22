import { useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import MainCard from 'ui-component/cards/MainCard';
import DomainsTabs from './DomainsTabs';

// Sub-aba inicial via query (?sub=email|webchat|quiz) — usado pelos deep-links
// de Webchats ("Cadastrar domínio") e Quizzes.
export default function DomainsPage() {
  const [params] = useSearchParams();
  const sub = ['email', 'webchat', 'quiz'].includes(params.get('sub')) ? params.get('sub') : 'email';

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <MainCard content={false} sx={{ borderRadius: 3, p: { xs: 2, md: 3 } }}>
        <DomainsTabs initialTab={sub} />
      </MainCard>
    </Box>
  );
}
