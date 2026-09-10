import { createInertiaApp } from '@inertiajs/react';

const appName = 'Volcano Watch';

void createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    progress: {
        color: '#4B5563',
    },
});
