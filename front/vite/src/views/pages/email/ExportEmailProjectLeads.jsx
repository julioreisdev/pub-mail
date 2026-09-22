// src/views/email-marketing/components/ExportEmailProjectLeads.jsx
import { useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { DownloadRoundedIcon as DownloadRoundedIcon } from 'ui-component/icons';
import toast from 'react-hot-toast';

import { get } from '../../../api/api';

const getErrorMessage = (err, fallback = 'Ocorreu um erro') => {
    return err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
};

export default function ExportEmailProjectLeads({ projectId }) {
    const [loading, setLoading] = useState(false);

    const handleExport = async () => {
        if (loading || !projectId) return;

        setLoading(true);
        toast.loading('Preparando arquivo...', { id: 'export-project-leads-toast' });

        try {
            const response = await get(`/email/projects/${projectId}/export`, {
                responseType: 'blob'
            });

            const fileData = response?.data || response;

            const blob = new Blob([fileData], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            const url = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `project_${projectId}_leads.xlsx`);
            document.body.appendChild(link);

            link.click();

            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast.success('Download concluído!', { id: 'export-project-leads-toast' });
        } catch (e) {
            console.error(e);
            toast.error(getErrorMessage(e, 'Falha ao exportar leads do projeto'), { id: 'export-project-leads-toast' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            onClick={handleExport}
            disabled={loading || !projectId}
            variant="outlined"
            color="inherit"
            size="small"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <DownloadRoundedIcon fontSize="small" />}
            sx={{ borderRadius: 2 }}
        >
            Exportar leads deste projeto
        </Button>
    );
}
