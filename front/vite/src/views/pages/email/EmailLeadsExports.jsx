import { useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import toast from 'react-hot-toast';

import { get } from '../../../api/api';

const getErrorMessage = (err, fallback = 'Ocorreu um erro') => {
    return err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
};

export default function ExportEmailLeads() {
    const [loading, setLoading] = useState(false);

    const handleExport = async () => {
        if (loading) return;

        setLoading(true);
        toast.loading('Preparando arquivo...', { id: 'export-toast' }); // Toast de loading opcional, fica legal!

        try {
            // 1. OBRIGATÓRIO: Avisar o Axios que esperamos um arquivo binário (blob)
            // Passe o responseType nas configurações do seu wrapper 'get'
            const response = await get('/email/leads/export', {
                responseType: 'blob'
            });

            // 2. Dependendo de como seu wrapper 'api/api.js' funciona,
            // a resposta pode estar em 'response.data' ou direto em 'response'.
            // Vamos assumir que ele retorna o objeto do Axios completo ou apenas o dado.
            const fileData = response.data || response;

            // 3. Cria um Blob (Binary Large Object) com os dados
            const blob = new Blob([fileData], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            // 4. Cria uma URL temporária no navegador para esse Blob
            const url = window.URL.createObjectURL(blob);

            // 5. Truque do link HTML invisível
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'all_leads.xlsx'); // Nome do arquivo que vai salvar
            document.body.appendChild(link);

            // 6. Força o clique para iniciar o download
            link.click();

            // 7. Limpeza da memória
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast.success('Download concluído!', { id: 'export-toast' });
        } catch (e) {
            console.error(e);
            toast.error(getErrorMessage(e, 'Falha ao exportar leads'), { id: 'export-toast' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            onClick={handleExport}
            disabled={loading}
            variant="contained"
            size="small"
            color="primary"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <DownloadRoundedIcon fontSize="small" />}
            sx={{ borderRadius: 2 }}
        >
            Exportar todos os leads
        </Button>
    );
}
