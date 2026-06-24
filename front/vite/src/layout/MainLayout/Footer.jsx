// import { Link as RouterLink } from 'react-router-dom';

// material-ui
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export default function Footer() {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', pt: 3, mt: 'auto' }}>
      <Typography variant="caption">
        Todos os direitos reservados{' '}
        <Typography component={Link} href="/login" underline="hover" target="_blank" sx={{ color: 'secondary.main' }}>
          Pub Mail
        </Typography>
      </Typography>

      {/* Comentado: links extras (GitHub / Figma) */}
      {/*
      <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
        <Link
          component={RouterLink}
          to="https://github.com/codedthemes/berry-free-react-admin-template"
          underline="hover"
          target="_blank"
          variant="caption"
          color="text.primary"
        >
          GitHub
        </Link>
        <Link
          component={RouterLink}
          to="https://www.figma.com/community/file/1468460364009262125/berry-free-dashboard-ui-kit"
          underline="hover"
          target="_blank"
          variant="caption"
          color="text.primary"
        >
          Figma UI Kit
        </Link>
      </Stack>
      */}
    </Stack>
  );
}
