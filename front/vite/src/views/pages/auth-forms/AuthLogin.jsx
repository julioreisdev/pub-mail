import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// material-ui
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

// project imports
import AnimateButton from 'ui-component/extended/AnimateButton';
import CustomFormControl from 'ui-component/extended/Form/CustomFormControl';

// assets
import { VisibilityIcon as Visibility } from 'ui-component/icons';
import { VisibilityOffIcon as VisibilityOff } from 'ui-component/icons';

import { useAuth } from 'contexts/AuthContext';

// ===============================|| JWT - LOGIN ||=============================== //

export default function AuthLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(''); // pode ser email OU username
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleClickShowPassword = () => setShowPassword((prev) => !prev);

  const handleMouseDownPassword = (event) => {
    event.preventDefault();
  };

  const extractErrorMessage = (err) => {
    const apiMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message;
    if (typeof apiMsg === 'string' && apiMsg.trim()) return apiMsg;
    return err?.response?.data?.message[0] || 'Não foi possível fazer login. Tente novamente.';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    setErrorMsg('');

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Preencha e-mail/usuário e senha.');
      return;
    }

    setIsSubmitting(true);

    try {
      await login({ email: email.trim(), password });

      // ✅ pós-login: volta pra rota que tentou acessar (RequireAuth manda `from`)
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {errorMsg ? (
        <Box sx={{ mb: 2 }}>
          <Alert severity="error">{errorMsg}</Alert>
        </Box>
      ) : null}

      <CustomFormControl fullWidth>
        <InputLabel htmlFor="outlined-adornment-email-login">E-mail ou usuário</InputLabel>
        <OutlinedInput
          id="outlined-adornment-email-login"
          type="text"
          value={email}
          name="email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Digite seu e-mail ou usuário"
          autoComplete="username"
          disabled={isSubmitting}
        />
      </CustomFormControl>

      <CustomFormControl fullWidth>
        <InputLabel htmlFor="outlined-adornment-password-login">Senha</InputLabel>
        <OutlinedInput
          id="outlined-adornment-password-login"
          type={showPassword ? 'text' : 'password'}
          value={password}
          name="password"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Digite sua senha"
          autoComplete="current-password"
          disabled={isSubmitting}
          endAdornment={
            <InputAdornment position="end">
              <IconButton
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={handleClickShowPassword}
                onMouseDown={handleMouseDownPassword}
                edge="end"
                size="small"
                sx={{ color: 'text.secondary', mr: 0.25 }}
                disabled={isSubmitting}
              >
                {showPassword ? <Visibility fontSize="small" /> : <VisibilityOff fontSize="small" />}
              </IconButton>
            </InputAdornment>
          }
          label="Senha"
        />
      </CustomFormControl>

      <Box sx={{ mt: 2 }}>
        <AnimateButton>
          <Button
            color="primary"
            fullWidth
            size="large"
            type="submit"
            variant="contained"
            disabled={isSubmitting}
            disableElevation
            startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : null}
            sx={{ borderRadius: 2.5, py: 1.4, fontWeight: 700, fontSize: 15 }}
          >
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </AnimateButton>
      </Box>
    </form>
  );
}
