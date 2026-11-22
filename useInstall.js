import { useCallback, useEffect, useState } from 'react';

/** "Install app" support: Android/desktop install prompt, plus instructions on iPhone. */
export function useInstall() {
  const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const [evt, setEvt] = useState(null);
  const [installed, setInstalled] = useState(standalone);
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setEvt(e); };
    const onInstalled = () => { setInstalled(true); setEvt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const prompt = useCallback(async () => {
    if (!evt) return;
    evt.prompt();
    try { await evt.userChoice; } finally { setEvt(null); }
  }, [evt]);
  const available = !installed && !window.__UCC_NATIVE__ && (!!evt || ios);
  return { available, ios: ios && !evt, prompt };
}
