import { useEffect, useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import { EmailRoundedIcon as EmailRoundedIcon } from 'ui-component/icons';
import { DomainRoundedIcon as DomainRoundedIcon } from 'ui-component/icons';
import { QuizRoundedIcon as QuizRoundedIcon } from 'ui-component/icons';
import Domains from './Domains';
import DomainsWebchat from './DomainsWebchat';
import DomainsQuiz from './DomainsQuiz';
import useAccess from 'hooks/useAccess';

const ALL_TABS = [
    { key: 'email', label: 'E-mail', Icon: EmailRoundedIcon, Comp: Domains },
    { key: 'webchat', label: 'Webchat', Icon: DomainRoundedIcon, Comp: DomainsWebchat },
    { key: 'quiz', label: 'Quizzes', Icon: QuizRoundedIcon, Comp: DomainsQuiz }
];

export default function DomainsTabs({ initialTab = 'email' }) {
    const { has } = useAccess();
    // Só as abas dos módulos liberados pro usuário (cada aba busca o endpoint do seu módulo).
    const tabs = ALL_TABS.filter((t) => has(t.key));
    const indexOf = (key) => Math.max(0, tabs.findIndex((t) => t.key === key));
    const [tab, setTab] = useState(indexOf(initialTab));

    useEffect(() => {
        setTab(indexOf(initialTab));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialTab, tabs.length]);

    if (tabs.length === 0) {
        return <Box sx={{ color: 'text.secondary', py: 3 }}>Nenhum módulo com domínios está incluído no seu acesso.</Box>;
    }
    const Active = (tabs[tab] || tabs[0]).Comp;

    return (
        <>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs
                    value={tab}
                    onChange={(_, nextTab) => setTab(nextTab)}
                    textColor="secondary"
                    indicatorColor="secondary"
                    sx={{
                        minHeight: 44,
                        '& .MuiTab-root': { minHeight: 44, textTransform: 'none', fontWeight: 800 }
                    }}
                >
                    {tabs.map((t) => (
                        <Tab key={t.key} icon={<t.Icon fontSize="small" />} iconPosition="start" label={t.label} />
                    ))}
                </Tabs>
            </Box>

            <Active />
        </>
    );
}
