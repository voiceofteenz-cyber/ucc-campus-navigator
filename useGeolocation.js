import { useCallback, useEffect, useRef, useState } from 'react';

// Live device position via the browser Geolocation API (real GPS / network location only).
// status: idle | locating | watching | denied | unavailable | timeout | unsupported | insecure

const MESSAGES = {
  unsupported: 'This browser does not support location services. Try Chrome, Safari or Firefox.',
  insecure: 'Location only works on a secure (https://) connection. Open the app via its https address.',
  denied: 'Location permission was denied. Allow location access for this site in your browser settings, then tap "Try again".',
  unavailable: 'Your position could not be determined. Turn on GPS / Location services and make sure you have signal.',
  timeout: 'Finding your location is taking too long. Move to an open area and tap "Try again".',
};

export function useGeolocation() {
  const [state, setState] = useState({ status: 'idle', position: null, error: null });
  const watchId = useRef(null);

  const stop = useCallback(() => {
    if (watchId.current != null && 'geolocation' in navigator) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }, []);

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState((s) => ({ ...s, status: 'unsupported', error: MESSAGES.unsupported })); return;
    }
    if (!window.isSecureContext) {
      setState((s) => ({ ...s, status: 'insecure', error: MESSAGES.insecure })); return;
    }
    stop();
    setState((s) => ({ ...s, status: s.position ? 'watching' : 'locating', error: null }));
    watchId.current = navigator.geolocation.watchPosition(
      (p) => setState({
        status: 'watching',
        error: null,
        position: {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          heading: Number.isFinite(p.coords.heading) ? p.coords.heading : null,
          speed: Number.isFinite(p.coords.speed) ? p.coords.speed : null,
          timestamp: p.timestamp,
        },
      }),
      (err) => {
        const status = err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable';
        setState((s) => ({
          ...s,
          // A timeout while we already have fixes is not fatal — the watch keeps running.
          status: s.position && status === 'timeout' ? 'watching' : status,
          error: s.position && status === 'timeout' ? null : MESSAGES[status],
        }));
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 25000 },
    );
  }, [stop]);

  useEffect(() => {
    start();
    // Restart automatically if the user grants permission later from browser settings.
    let perm;
    navigator.permissions?.query({ name: 'geolocation' }).then((p) => {
      perm = p;
      p.onchange = () => { if (p.state === 'granted') start(); };
    }).catch(() => {});
    return () => { stop(); if (perm) perm.onchange = null; };
  }, [start, stop]);

  return { ...state, start };
}
