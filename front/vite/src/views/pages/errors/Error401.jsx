import { useNavigate } from 'react-router-dom';
import ErrorLayout from './ErrorLayout';

export default function Error401() {
    const navigate = useNavigate();

    return (
        <ErrorLayout
            code="401"
            title="Acesso não autorizado"
            description="Você não tem permissão para acessar este conteúdo. Faça login novamente."
            primaryActionLabel="Ir para Login"
            onPrimaryAction={() => navigate('/login', { replace: true })}
            secondaryActionLabel="Voltar"
            onSecondaryAction={() => navigate(-1)}
        />
    );
}
