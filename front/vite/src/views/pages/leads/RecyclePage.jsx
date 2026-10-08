import Box from '@mui/material/Box';
import MainCard from 'ui-component/cards/MainCard';
import RecycleTab from './RecycleTab';

export default function RecyclePage() {
  return (
    <Box>
      <MainCard content={false} sx={{ borderRadius: 3, p: { xs: 2, md: 3 } }}>
        <RecycleTab />
      </MainCard>
    </Box>
  );
}
