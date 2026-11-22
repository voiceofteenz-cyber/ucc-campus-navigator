import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Printer } from 'lucide-react';
import { CATEGORIES } from '../../shared/categories.js';

/** Printable A4 sign with a QR code for a campus place ("You are here" boards / door signs). */
export default function SignView({ place, onClose }) {
  const [qr, setQr] = useState(null);
  const isCampus = !String(place.id).startsWith('pin/');
  const url = isCampus
    ? `${window.location.origin}/?place=${encodeURIComponent(place.id)}&src=sign`
    : `${window.location.origin}/?at=${place.lat.toFixed(6)},${place.lng.toFixed(6)}&n=${encodeURIComponent(place.name)}&src=sign`;

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 720, errorCorrectionLevel: 'M', color: { dark: '#14161F', light: '#FFFFFF' } })
      .then(setQr).catch(() => setQr(null));
  }, [url]);

  return (
    <div className="print-area absolute inset-0 z-[1300] overflow-y-auto bg-slate-100 p-4 md:p-8">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2">
        <button onClick={onClose} className="btn-outline py-2"><X size={16} /> Close</button>
        <p className="hidden text-sm text-ink-500 sm:block">Print on A4, laminate and fix it at the entrance.</p>
        <button onClick={() => window.print()} className="btn-primary py-2"><Printer size={16} /> Print sign</button>
      </div>

      {/* The sign itself (always light, even in dark mode) */}
      <div className="sign-sheet mx-auto flex aspect-[210/297] w-full max-w-[210mm] flex-col items-center justify-between rounded-2xl p-[8%] text-center shadow-float"
        style={{ color: '#14161F', background: '#FFFFFF' }}>
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 64 64" style={{ width: 56, height: 56 }} aria-hidden="true">
            <rect width="64" height="64" rx="16" fill="#2E2D88" />
            <path d="M32 12c-8.3 0-15 6.5-15 14.6C17 37.5 32 52 32 52s15-14.5 15-25.4C47 18.5 40.3 12 32 12z" fill="#fff" />
            <path d="M32 16.5L36.2 26.6H27.8Z" fill="#E34234" /><path d="M32 36.7L36.2 26.6H27.8Z" fill="#2E2D88" />
            <circle cx="32" cy="26.6" r="2" fill="#FDEE00" />
          </svg>
          <div className="text-left">
            <p style={{ color: '#2E2D88', fontWeight: 800, fontSize: 22, lineHeight: 1.1 }}>UCC Campus Navigator</p>
            <p style={{ color: '#5B6074', fontSize: 13 }}>University of Cape Coast</p>
          </div>
        </div>

        <div>
          <p style={{ color: '#E34234', fontWeight: 800, letterSpacing: 2, fontSize: 14, textTransform: 'uppercase' }}>You are here</p>
          <p style={{ fontWeight: 800, fontSize: 'clamp(22px, 5vw, 40px)', lineHeight: 1.15, marginTop: 6 }}>{place.name}</p>
          <p style={{ color: '#5B6074', fontSize: 15, marginTop: 4 }}>{CATEGORIES[place.category]?.short || 'Campus place'}</p>
        </div>

        <div className="flex flex-col items-center">
          {qr ? <img src={qr} alt={`QR code for ${place.name}`} style={{ width: '62%', maxWidth: 360, imageRendering: 'pixelated' }} /> : <div style={{ width: 240, height: 240 }} />}
          <p style={{ fontWeight: 800, fontSize: 'clamp(18px, 3.5vw, 26px)', marginTop: 14 }}>Scan to find any building on campus</p>
          <p style={{ color: '#5B6074', fontSize: 14, marginTop: 4 }}>Live walking, car and motorbike directions from where you stand. No app download needed.</p>
        </div>

        <p style={{ color: '#2E2D88', fontWeight: 700, fontSize: 13 }}>{window.location.host}</p>
      </div>
    </div>
  );
}
