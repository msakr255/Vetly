/* =====================================================================
   core/config.js
   اسم الأداة واللوجو + أدوات React المشتركة (بتتحمل الأول).
   ===================================================================== */

const { useState, useEffect } = React;

// اسم الأداة (غيّره من هنا بس وهيتغير في كل مكان)
const APP_NAME = 'Vetly';
const APP_TAGLINE = 'QA Workbench';
const APP_DESIGNER = 'Eng. Mohamed Sakr';
const APP_DESIGNER_TITLE = 'Software Testing Engineer';

const AppLogo = ({ size = 36 }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-label={APP_NAME}>
        <defs>
            <linearGradient id="qatchGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#2563eb" />
                <stop offset="1" stopColor="#7c3aed" />
            </linearGradient>
        </defs>
        <rect width="40" height="40" rx="10" fill="url(#qatchGrad)" />
        <circle cx="19" cy="19" r="9" fill="none" stroke="white" strokeWidth="3" />
        <path d="M14.5 19.5l3.2 3.2 6-6.4" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M25.5 25.5L31 31" stroke="white" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
);
