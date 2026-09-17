import { useEffect, useState } from 'react';

export function useMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const breakpoint =
      getComputedStyle(document.documentElement).getPropertyValue('--breakpoint-mobile').trim() ||
      '48rem';
    const query = window.matchMedia(`(width < ${breakpoint})`);
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return mobile;
}
