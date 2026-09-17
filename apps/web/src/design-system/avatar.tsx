import { useState } from 'react';
export function Avatar({
  name,
  src,
  size = 'medium',
}: {
  name: string;
  src?: string;
  size?: 'small' | 'medium' | 'large';
}) {
  const [failed, setFailed] = useState(false);
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? '')
      .join('')
      .toUpperCase() || '?';
  return (
    <span className={`avatar avatar--${size}`} role="img" aria-label={name}>
      {src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} /> : initials}
    </span>
  );
}
