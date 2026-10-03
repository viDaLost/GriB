import { useEffect, useState } from 'react';
import { Button } from './components';
import { fonts, colors } from './theme';

export interface Crop { x: number; y: number; side: number }

/** Crop in source pixels; the frame matches exactly what inference will see. */
export function PhotoCrop({ file, disabled, onAnalyze }: { file: File; disabled: boolean; onAnalyze: (blob: Blob) => void }) {
  const [source, setSource] = useState<{ image: HTMLImageElement; url: string } | null>(null);
  const [center, setCenter] = useState({ x: 0.5, y: 0.5 });
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState('');
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    let active = true;
    img.src = url;
    img.decode().then(() => { if (active) setSource({ image: img, url }); }).catch(() => { if (active) setError('Не удалось открыть фото. Выберите JPEG, PNG или снимок с камеры.'); });
    return () => { active = false; URL.revokeObjectURL(url); };
  }, [file]);

  if (error) return <div style={{ color: colors.accent }}>{error}</div>;
  if (!source) return <div style={{ color: colors.muted }}>Открываю фото…</div>;
  const w = source.image.naturalWidth, h = source.image.naturalHeight;
  const side = Math.min(w, h) / zoom;
  const crop: Crop = {
    x: Math.max(0, Math.min(w - side, center.x * w - side / 2)),
    y: Math.max(0, Math.min(h - side, center.y * h - side / 2)), side,
  };
  const analyze = () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(1280, Math.round(side));
    const ctx = canvas.getContext('2d');
    if (!ctx) { setError('Браузер не поддерживает обработку фото.'); return; }
    ctx.drawImage(source.image, crop.x, crop.y, side, side, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => { if (blob) onAnalyze(blob); else setError('Не удалось подготовить фото. Попробуйте другой снимок.'); }, 'image/jpeg', 0.95);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 17, fontFamily: fonts.body, lineHeight: '26px', color: colors.muted }}>Поместите один гриб в рамку. Коснитесь фото, чтобы переместить её; увеличьте, если гриб мелкий.</div>
      <div onPointerDown={(e) => {
        if (disabled) return;
        const box = e.currentTarget.getBoundingClientRect();
        setCenter({ x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height });
      }} style={{ position: 'relative', width: '100%', maxWidth: Math.min(360, 420 * w / h), margin: '0 auto', touchAction: 'pan-y', overflow: 'hidden', borderRadius: 20, aspectRatio: `${w} / ${h}` }}>
        <img src={source.url} alt="Выбранный гриб. Коснитесь нужного участка." draggable={false} style={{ display: 'block', width: '100%', height: '100%' }} />
        <div style={{ position: 'absolute', left: `${crop.x / w * 100}%`, top: `${crop.y / h * 100}%`, width: `${side / w * 100}%`, height: `${side / h * 100}%`, boxSizing: 'border-box', border: '3px solid #FFFEFA', borderRadius: 12, boxShadow: '0 0 0 600px rgba(18,38,30,0.48)', pointerEvents: 'none' }} />
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
        <button type="button" aria-label="Уменьшить приближение" disabled={disabled || zoom <= 1} onClick={() => setZoom((v) => Math.max(1, v - 0.25))} style={control}>−</button>
        <span style={{ color: colors.primary, fontSize: 17, fontFamily: fonts.body }}>{zoom.toFixed(2)}×</span>
        <button type="button" aria-label="Увеличить приближение" disabled={disabled || zoom >= 3} onClick={() => setZoom((v) => Math.min(3, v + 0.25))} style={control}>+</button>
      </div>
      <Button title="Распознать этот участок" icon="search" onPress={analyze} disabled={disabled} />
    </div>
  );
}
const control = { width: 56, height: 52, border: `1px solid ${colors.border}`, background: colors.card, borderRadius: 14, color: colors.primary, fontSize: 28, cursor: 'pointer' };
