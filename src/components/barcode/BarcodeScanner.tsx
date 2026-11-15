import { useEffect, useRef, useState } from 'react';
import { CameraOff, Flashlight, ImagePlus } from 'lucide-react';
import type { IScannerControls } from '@zxing/browser';
import { Spinner } from '@/components/ui/Spinner';

interface Props {
  onDetected: (code: string) => void;
  paused?: boolean;
}

function cameraErrorMessage(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'No hay permiso para usar la cámara. Actívalo en los ajustes del navegador (en iPhone: Ajustes › Safari › Cámara) o introduce el código manualmente.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No se ha encontrado ninguna cámara en este dispositivo.';
  if (name === 'NotReadableError') return 'La cámara está siendo usada por otra aplicación.';
  if (!window.isSecureContext) return 'La cámara solo funciona en conexiones seguras (HTTPS).';
  return 'No se pudo iniciar la cámara. Puedes escanear desde una foto o escribir el código.';
}

async function createReader() {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.ITF]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
}

/** Lector de códigos EAN/UPC con la cámara (ZXing, funciona en Safari iOS). */
export function BarcodeScanner({ onDetected, paused }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting');
  const [error, setError] = useState<string>();
  const [torch, setTorch] = useState<boolean | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const detectedRef = useRef(onDetected);
  detectedRef.current = onDetected;

  useEffect(() => {
    if (paused) return;
    let cancelled = false;
    setStatus('starting');
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('no media'), { name: 'NotFoundError' });
        const reader = await createReader();
        if (cancelled || !video.current) return;
        const c = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
          video.current,
          (result) => {
            if (result) {
              navigator.vibrate?.(60);
              detectedRef.current(result.getText());
            }
          },
        );
        if (cancelled) return c.stop();
        controls.current = c;
        setTorch(c.switchTorch ? false : null);
        setStatus('scanning');
      } catch (e) {
        if (!cancelled) {
          setStatus('error');
          setError(cameraErrorMessage(e));
        }
      }
    })();
    return () => {
      cancelled = true;
      controls.current?.stop();
      controls.current = null;
    };
  }, [paused]);

  const scanFile = async (file: File) => {
    const url = URL.createObjectURL(file);
    try {
      const reader = await createReader();
      const res = await reader.decodeFromImageUrl(url);
      setError(undefined);
      detectedRef.current(res.getText());
    } catch {
      setError('No se ha encontrado un código de barras en la imagen. Prueba con una foto más cercana y nítida.');
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-4xl bg-ink-900">
        <video ref={video} className="h-full w-full object-cover" muted playsInline autoPlay />
        {status === 'scanning' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-[42%] w-[78%] rounded-3xl ring-2 ring-white/80 [box-shadow:0_0_0_9999px_rgba(10,37,25,.45)]">
              <div className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-brand-300 shadow-[0_0_12px_#82d1a4]" />
            </div>
          </div>
        )}
        {status === 'starting' && !paused && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
            <Spinner className="h-7 w-7" /> <span className="text-sm">Iniciando cámara…</span>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <CameraOff className="h-8 w-8 text-white/70" />
            <p className="max-w-sm text-sm text-white/85">{error}</p>
          </div>
        )}
        {torch !== null && status === 'scanning' && (
          <button
            aria-label={torch ? 'Apagar linterna' : 'Encender linterna'}
            className={`absolute right-3 top-3 rounded-full p-3 backdrop-blur ${torch ? 'bg-white text-ink-900' : 'bg-ink-900/50 text-white'}`}
            onClick={async () => {
              await controls.current?.switchTorch?.(!torch);
              setTorch(!torch);
            }}
          >
            <Flashlight className="h-5 w-5" />
          </button>
        )}
      </div>
      {status === 'scanning' && <p className="mt-3 text-center text-sm text-ink-500">Centra el código de barras dentro del recuadro</p>}
      {error && status !== 'error' && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) scanFile(f);
        }}
      />
      <button className="btn-ghost mt-2 w-full text-sm" onClick={() => fileInput.current?.click()}>
        <ImagePlus className="h-4 w-4" /> Leer el código desde una foto
      </button>
    </div>
  );
}
