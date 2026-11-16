import { useEffect, useState } from 'react';

const query = '(prefers-color-scheme: dark)';

/** Applies light/dark theme to the page. mode: 'light' | 'dark' | 'auto' (follows the device). */
export function useTheme(mode = 'auto') {
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return undefined;
    const on = () => setSystemDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const isDark = mode === 'dark' || (mode === 'auto' && systemDark);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#0E1020' : '#2E2D88');
  }, [isDark]);
  return isDark;
}
