import { useNavigate } from 'react-router-dom';
import ErrorLayout from './ErrorLayout';

export default function Error503() {
    const navigate = useNavigate();

    return (
        <ErrorLayout
            code="503"
            title="Serviço indisponível"
            description="Parece que nossa API está indisponível no momento. Tente novamente em instantes."
            primaryActionLabel="Tentar novamente"
            onPrimaryAction={() => window.location.reload()}
            secondaryActionLabel="Voltar ao Dashboard"
            onSecondaryAction={() => navigate('/', { replace: true })}
        />
    );
}
