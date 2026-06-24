import { useNavigate } from 'react-router-dom';
import ErrorLayout from './ErrorLayout';

export default function ErrorGeneric({ title, description, code }) {
    const navigate = useNavigate();

    return (
        <ErrorLayout
            code={code || 'Erro'}
            title={title || 'Algo deu errado'}
            description={description || 'Ocorreu um erro inesperado.'}
            primaryActionLabel="Recarregar"
            onPrimaryAction={() => window.location.reload()}
            secondaryActionLabel="Voltar ao Dashboard"
            onSecondaryAction={() => navigate('/', { replace: true })}
        />
    );
}
