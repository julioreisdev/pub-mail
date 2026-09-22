import { useEffect, useState } from 'react';
import { get } from '../../../api/api';

// Busca uma imagem protegida por JWT (proxy no back) como blob → objectURL, com cache.
// <img src> puro não manda Authorization e tomaria 401.
const imgCache = new Map();

export default function AuthImage({ path, alt, size, rounded = '50%', imgStyle, fallback }) {
    const [url, setUrl] = useState(() => imgCache.get(path));

    useEffect(() => {
        let alive = true;
        const cached = imgCache.get(path);
        if (cached) {
            setUrl(cached);
            return undefined;
        }
        get(path, { responseType: 'blob' })
            .then((blob) => {
                const obj = URL.createObjectURL(blob);
                imgCache.set(path, obj);
                if (alive) setUrl(obj);
            })
            .catch(() => {
                imgCache.set(path, 'none');
                if (alive) setUrl('none');
            });
        return () => {
            alive = false;
        };
    }, [path]);

    if (url && url !== 'none') {
        return (
            <img
                src={url}
                alt={alt || ''}
                style={{ width: size, height: size, borderRadius: rounded, objectFit: 'cover', display: 'block', ...imgStyle }}
            />
        );
    }
    return fallback;
}
