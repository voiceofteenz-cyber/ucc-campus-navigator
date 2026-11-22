// Spoken navigation via the Web Speech API (where the browser supports it).

// Inside the UCC Navigator mobile app (Expo), speech is done natively via a bridge.
const nativeApp = typeof window !== 'undefined' && !!window.__UCC_NATIVE__;
export const speechSupported = nativeApp || (typeof window !== 'undefined' && 'speechSynthesis' in window);

let voice = null;
function pickVoice() {
  if (!speechSupported) return null;
  const voices = window.speechSynthesis.getVoices();
  voice = voices.find((v) => /en[-_]GH/i.test(v.lang)) ||
    voices.find((v) => /en[-_]GB/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) || null;
  return voice;
}
if (speechSupported && !nativeApp) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = pickVoice;
}

export function speak(text, { interrupt = true } = {}) {
  if (!speechSupported || !text) return;
  if (nativeApp) { window.__uccSpeak?.(text); return; }
  try {
    if (interrupt) window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice || pickVoice()) u.voice = voice;
    u.rate = 1;
    u.lang = voice?.lang || 'en-GB';
    window.speechSynthesis.speak(u);
  } catch { /* speech is best-effort */ }
}

export function stopSpeaking() {
  if (nativeApp) window.__uccStopSpeak?.();
  else if (speechSupported) window.speechSynthesis.cancel();
}
