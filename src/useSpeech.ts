// Speech to text. Uses the browser's own recognition (Chrome, Edge, Safari: free and instant);
// where that doesn't exist (Firefox), records audio and sends it to /api/transcribe (Groq Whisper, free tier).
import { useCallback, useEffect, useRef, useState } from 'react';

type Rec = {
  lang: string; interimResults: boolean; continuous: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

const RecCtor = (): (new () => Rec) | null =>
  (typeof window !== 'undefined' && ((window as unknown as { SpeechRecognition?: new () => Rec }).SpeechRecognition
    || (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition)) || null;

export type SpeechMode = 'browser' | 'server' | 'none';

export function useSpeech(onFinal: (text: string) => void) {
  const mode: SpeechMode = RecCtor() ? 'browser' : typeof MediaRecorder !== 'undefined' && navigator.mediaDevices ? 'server' : 'none';
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Rec | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const finalRef = useRef('');
  const onFinalRef = useRef(onFinal);
  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);

  const start = useCallback(async (lang: 'en-IN' | 'hi-IN') => {
    setError(null); setInterim(''); finalRef.current = '';
    if (mode === 'browser') {
      const Ctor = RecCtor()!;
      const rec = new Ctor();
      rec.lang = lang; rec.interimResults = true; rec.continuous = true;
      rec.onresult = (e) => {
        let fin = '', mid = '';
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) fin += r[0].transcript + ' '; else mid += r[0].transcript;
        }
        finalRef.current = fin;
        setInterim((fin + mid).trim());
      };
      rec.onerror = (e) => {
        setError(e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'Microphone access is blocked. Allow it in the address bar, or type instead.'
          : e.error === 'no-speech' ? "Didn't catch anything. Try again, a little closer to the mic." : 'Speech recognition stopped. Try again or type instead.');
      };
      rec.onend = () => {
        setListening(false);
        const text = (finalRef.current || '').trim();
        if (text) onFinalRef.current(text);
      };
      recRef.current = rec;
      try { rec.start(); setListening(true); } catch { setError('Could not start the microphone.'); }
      return;
    }
    if (mode === 'server') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks: Blob[] = [];
        const mr = new MediaRecorder(stream);
        mr.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
        mr.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          setListening(false); setBusy(true);
          try {
            const form = new FormData();
            form.append('audio', new Blob(chunks, { type: mr.mimeType || 'audio/webm' }));
            form.append('lang', lang.slice(0, 2));
            const res = await fetch('/api/transcribe', { method: 'POST', body: form });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            if (data.text) { setInterim(data.text); onFinalRef.current(data.text); }
          } catch (e) {
            setError(e instanceof Error && e.message ? e.message : 'Speech-to-text is unavailable right now. You can type instead.');
          } finally { setBusy(false); }
        };
        mediaRef.current = mr; mr.start(); setListening(true);
      } catch { setError('Microphone access is blocked. Allow it in the address bar, or type instead.'); }
      return;
    }
    setError("This browser can't record speech. Type your tasks instead.");
  }, [mode]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    if (mediaRef.current?.state === 'recording') mediaRef.current.stop();
  }, []);

  return { mode, listening, busy, interim, error, start, stop, setInterim };
}

/** Reads text aloud with the device's own voice (free, works offline). */
export function speak(text: string) {
  if (!('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  u.voice = voices.find((v) => v.lang === 'en-IN') || voices.find((v) => v.lang.startsWith('en')) || null;
  u.rate = 1;
  window.speechSynthesis.speak(u);
  return true;
}
