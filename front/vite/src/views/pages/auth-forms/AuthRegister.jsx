import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

// project imports
import AnimateButton from 'ui-component/extended/AnimateButton';
import CustomFormControl from 'ui-component/extended/Form/CustomFormControl';
import { strengthColor, strengthIndicator } from 'utils/password-strength';

// assets
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

import { post } from '../../../api/api';

export default function AuthRegister() {
  const navigate = useNavigate();

  // ✅ campos finais
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  const [strength, setStrength] = useState(0);
  const [level, setLevel] = useState();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleClickShowPassword = () => setShowPassword((prev) => !prev);
  const handleMouseDownPassword = (event) => event.preventDefault();

  const changePassword = (value) => {
    const temp = strengthIndicator(value);
    setStrength(temp);
    setLevel(strengthColor(temp));
  };

  const traduzirNivelSenha = (label) => {
    const map = {
      Poor: 'Muito fraca',
      Weak: 'Fraca',
      Normal: 'Média',
      Good: 'Boa',
      Strong: 'Forte'
    };
    return map[label] || label;
  };

  const extractErrorMessage = (err) => {
    const apiMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message;
    if (typeof apiMsg === 'string' && apiMsg.trim()) return apiMsg;
    return err?.response?.data?.message[0] || 'Não foi possível criar sua conta. Tente novamente.';
  };

  useEffect(() => {
    changePassword('');
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    setErrorMsg('');
    setSuccessMsg('');

    // validação simples (obrigatórios)
    if (!name.trim() || !companyName.trim() || !email.trim() || !password.trim()) {
      setErrorMsg('Preencha todos os campos obrigatórios.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        password,
        organization_name: companyName.trim()
      };

      // ✅ ajuste a rota se necessário
      const result = await post('/auth/register', payload);

      // Alguns back-ends já devolvem token e user no register
      const token = result?.tokens?.accessToken;
      const user = result?.user;

      // Se veio token: já considera logado e manda pro dashboard
      if (token) {
        localStorage.setItem('token', token);

        if (user) localStorage.setItem('user', JSON.stringify(user));
        else localStorage.removeItem('user');

        window.location.reload();
        return;
      }

      // Se não veio token: conta criada -> manda pro login
      setSuccessMsg('Conta criada com sucesso! Você já pode entrar.');
      // pequena pausa opcional pra UX, mas sem setTimeout (evitar)
      navigate('/login', { replace: true });
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      {errorMsg ? (
        <Box sx={{ mb: 2 }}>
          <Alert severity="error">{errorMsg}</Alert>
        </Box>
      ) : null}

      {successMsg ? (
        <Box sx={{ mb: 2 }}>
          <Alert severity="success">{successMsg}</Alert>
        </Box>
      ) : null}

      <Stack direction="column" sx={{ gap: 1.5 }}>
        <CustomFormControl fullWidth>
          <InputLabel htmlFor="outlined-adornment-name-register">Nome completo</InputLabel>
          <OutlinedInput
            id="outlined-adornment-name-register"
            type="text"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Digite seu nome completo"
            autoComplete="name"
            disabled={isSubmitting}
          />
        </CustomFormControl>

        <CustomFormControl fullWidth>
          <InputLabel htmlFor="outlined-adornment-company-register">Nome da empresa/projeto</InputLabel>
          <OutlinedInput
            id="outlined-adornment-company-register"
            type="text"
            name="company_name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Ex: Minha Empresa, Projeto X..."
            autoComplete="organization"
            disabled={isSubmitting}
          />
        </CustomFormControl>
      </Stack>

      <CustomFormControl fullWidth>
        <InputLabel htmlFor="outlined-adornment-email-register">E-mail</InputLabel>
        <OutlinedInput
          id="outlined-adornment-email-register"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          name="email"
          placeholder="Digite seu e-mail"
          autoComplete="email"
          disabled={isSubmitting}
        />
      </CustomFormControl>

      <CustomFormControl fullWidth>
        <InputLabel htmlFor="outlined-adornment-password-register">Senha</InputLabel>
        <OutlinedInput
          id="outlined-adornment-password-register"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            changePassword(e.target.value);
          }}
          name="password"
          label="Senha"
          placeholder="Digite sua senha"
          autoComplete="new-password"
          disabled={isSubmitting}
          endAdornment={
            <InputAdornment position="end">
              <Button
                onClick={handleClickShowPassword}
                onMouseDown={handleMouseDownPassword}
                sx={{ minWidth: 0, px: 1 }}
                disabled={isSubmitting}
              >
                {showPassword ? <Visibility /> : <VisibilityOff />}
              </Button>
            </InputAdornment>
          }
        />
      </CustomFormControl>

      {strength !== 0 && (
        <FormControl fullWidth>
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" sx={{ gap: 2, alignItems: 'center' }}>
              <Box sx={{ width: 85, height: 8, borderRadius: '7px', bgcolor: level?.color }} />
              <Typography variant="subtitle1" sx={{ fontSize: '0.75rem' }}>
                {traduzirNivelSenha(level?.label)}
              </Typography>
            </Stack>
          </Box>
        </FormControl>
      )}

      <Box sx={{ mt: 2 }}>
        <AnimateButton>
          <Button
            disableElevation
            fullWidth
            size="large"
            type="submit"
            variant="contained"
            color="secondary"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={18} /> : null}
          >
            {isSubmitting ? 'Criando...' : 'Criar conta'}
          </Button>
        </AnimateButton>
      </Box>
    </Box>
  );
}
