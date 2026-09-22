import { useEffect, useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import { EmailRoundedIcon as EmailRoundedIcon } from 'ui-component/icons';
import { DomainRoundedIcon as DomainRoundedIcon } from 'ui-component/icons';
import { QuizRoundedIcon as QuizRoundedIcon } from 'ui-component/icons';
import Domains from './Domains';
import DomainsWebchat from './DomainsWebchat';
import DomainsQuiz from './DomainsQuiz';

const TAB_BY_KEY = { email: 0, webchat: 1, quiz: 2 };

export default function DomainsTabs({ initialTab = 'email' }) {
    const [tab, setTab] = useState(TAB_BY_KEY[initialTab] ?? 0);

    useEffect(() => {
        setTab(TAB_BY_KEY[initialTab] ?? 0);
    }, [initialTab]);

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
                    <Tab icon={<EmailRoundedIcon fontSize="small" />} iconPosition="start" label="E-mail" />
                    <Tab icon={<DomainRoundedIcon fontSize="small" />} iconPosition="start" label="Webchat" />
                    <Tab icon={<QuizRoundedIcon fontSize="small" />} iconPosition="start" label="Quizzes" />
                </Tabs>
            </Box>

            {tab === 0 ? <Domains /> : tab === 1 ? <DomainsWebchat /> : <DomainsQuiz />}
        </>
    );
}
