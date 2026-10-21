'use client';

import { useEffect, useState, type ReactNode } from 'react';
import './backend-wake.css';

type Status = 'checking' | 'ready' | 'waiting';

export default function BackendWakeGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking');
  const [attempts, setAttempts] = useState(0);
  const [lastHttpStatus, setLastHttpStatus] = useState<number | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let activeController: AbortController | undefined;
    let count = 0;

    const check = async () => {
      activeController = new AbortController();
      const timeout = setTimeout(() => activeController?.abort(), 12000);
      let httpCode: number | null = null;
      try {
        const response = await fetch('/api/health', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
          signal: activeController.signal,
        });
        httpCode = response.status;
        if (response.ok) {
          const payload: unknown = await response.json();
          if (payload !== null && typeof payload === 'object' && 'ok' in payload && (payload as {ok: unknown}).ok === true) {
            if (!stopped) setStatus('ready');
            return;
          }
        }
      } catch {
        // Cold start / timeout / temporary proxy errors: retry instead of failing the UI.
      } finally {
        clearTimeout(timeout);
      }
      if (stopped) return;
      count += 1;
      setAttempts(count);
      setLastHttpStatus(httpCode);
      setStatus('waiting');
      // Render free backend may need a minute or longer after cold start.
      // Stop automatic attempts for persistent 404; this usually means broken proxy config.
      if (httpCode === 404 && count >= 3) return;
      timer = setTimeout(check, count < 12 ? 5000 : 10000);
    };

    void check();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      activeController?.abort();
    };
  }, [retryKey]);

  if (status === 'ready') return <>{children}</>;

  const hasConfigError = lastHttpStatus === 404 && attempts >= 3;
  return (
    <main className="backend-wake-screen" role="status" aria-live="polite">
      <section className="backend-wake-card">
        <div className="backend-wake-mark">D</div>
        <div className="backend-wake-company">DESECURE <strong>TECHNOLOGY</strong></div>
        {!hasConfigError && <div className="backend-wake-spinner" aria-hidden="true" />}
        <h1>{hasConfigError ? 'Sunucu bağlantısı kontrol edilmeli' : 'Sunucu başlatılıyor'}</h1>
        <p>
          {hasConfigError
            ? 'API adresi bulunamadı (404). Render frontend servisindeki API_PROXY_TARGET ayarını ve /api yönlendirmesini kontrol edin.'
            : 'Sunucu uyku modundan çıkıyor. Bağlantı hazır olduğunda uygulama otomatik açılacak.'}
        </p>
        {attempts > 0 && <span className="backend-wake-status">Bağlantı denemesi: {attempts + 1}{hasConfigError ? '' : ' · Otomatik yeniden deneniyor'}</span>}
        <button type="button" className="backend-wake-retry" onClick={() => { setStatus('checking'); setAttempts(0); setLastHttpStatus(null); setRetryKey(x => x + 1); }}>
          Yeniden dene
        </button>
      </section>
    </main>
  );
}
