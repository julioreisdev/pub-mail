import Box from '@mui/material/Box';
import MainCard from 'ui-component/cards/MainCard';
import TriggersTab from './TriggersTab';

export default function TriggersPage() {
  return (
    <Box>
      <MainCard content={false} sx={{ borderRadius: 3, p: { xs: 2, md: 3 } }}>
        <TriggersTab />
      </MainCard>
    </Box>
  );
}
