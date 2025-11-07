import React from 'react';
import { useTranslation } from 'react-i18next';

function Dashboard() {
    const { t } = useTranslation('common');
    return (
        <>
            <h1>{t('nav.dashboard')}</h1>
        </>
    );
}

export default Dashboard;
