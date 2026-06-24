import { useNavigate } from 'react-router-dom';
import ErrorLayout from './ErrorLayout';

export default function Error404() {
    const navigate = useNavigate();

    return (
        <ErrorLayout
            code="404"
            title="Página não encontrada"
            description="A página que você tentou acessar não existe ou foi movida."
            primaryActionLabel="Voltar ao Dashboard"
            onPrimaryAction={() => navigate('/dashboard', { replace: true })}
            secondaryActionLabel="Ir para Login"
            onSecondaryAction={() => navigate('/login', { replace: true })}
        />
    );
}
