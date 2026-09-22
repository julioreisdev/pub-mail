// Logo oficial do Telegram (avião de papel no círculo azul) — SVG inline, self-contained.
export default function TelegramLogo({ size = 40 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" aria-label="Telegram">
            <defs>
                <linearGradient id="tg-grad" x1="120" y1="0" x2="120" y2="240" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#2AABEE" />
                    <stop offset="1" stopColor="#229ED9" />
                </linearGradient>
            </defs>
            <circle cx="120" cy="120" r="120" fill="url(#tg-grad)" />
            <path
                fill="#fff"
                d="M53.6 118.7c34.9-15.2 58.2-25.2 69.8-30.1 33.2-13.8 40.2-16.2 44.7-16.3 1 0 3.2.2 4.7 1.4 1.2 1 1.5 2.3 1.7 3.3.2 1 .4 3.1.2 4.8-1.8 19.3-9.7 66.1-13.7 87.7-1.7 9.1-5 12.2-8.2 12.5-7 .6-12.3-4.6-19-9-10.6-6.9-16.5-11.2-26.8-18-11.9-7.8-4.2-12.1 2.6-19.1 1.8-1.8 32.5-29.8 33.1-32.3.1-.3.1-1.5-.6-2.1-.7-.6-1.7-.4-2.5-.2-1.1.2-18.9 12-53.5 35.4-5.1 3.5-9.7 5.2-13.8 5.1-4.5-.1-13.3-2.6-19.8-4.7-8-2.6-14.3-4-13.8-8.4.3-2.3 3.5-4.7 9.6-7.1z"
            />
        </svg>
    );
}
