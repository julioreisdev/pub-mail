import Box from '@mui/material/Box';
import MainCard from 'ui-component/cards/MainCard';
import RecycleTab from './RecycleTab';

export default function RecyclePage() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <MainCard content={false} sx={{ borderRadius: 3, p: { xs: 2, md: 3 } }}>
        <RecycleTab />
      </MainCard>
    </Box>
  );
}
