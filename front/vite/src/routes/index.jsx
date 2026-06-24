import { createBrowserRouter } from 'react-router-dom';

import PublicRoutes from './PublicRoutes';
import MainRoutes from './MainRoutes';

const router = createBrowserRouter([PublicRoutes, MainRoutes], {
  basename: import.meta.env.VITE_APP_BASE_NAME
});

export default router;
