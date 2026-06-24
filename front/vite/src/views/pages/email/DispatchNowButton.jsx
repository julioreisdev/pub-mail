import { useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import toast from 'react-hot-toast';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';

import { post } from '../../../api/api';

const getErrorMessage = (err, fallback = 'Ocorreu um erro') => {
    return err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
};

export function DispatchNowButton({ projectId, onDone }) {
    const [loading, setLoading] = useState(false);

    const handleDispatchNow = async () => {
        if (!projectId || loading) return;

        setLoading(true);
        try {
            await post(`/email/projects/${projectId}/dispatch-now`);
            toast.success('Envio disparado com sucesso!');
            onDone?.(); // opcional (ex: recarregar dados)
        } catch (e) {
            toast.error(getErrorMessage(e, 'Falha ao disparar envio agora'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            onClick={handleDispatchNow}
            disabled={!projectId || loading}
            variant="contained"
            color="secondary"
            startIcon={loading ? <CircularProgress size={16} /> : <RocketLaunchRoundedIcon fontSize="small" />}
            sx={{ borderRadius: 2 }}
        >
            Disparar Envio Agora!
        </Button>
    );
}
