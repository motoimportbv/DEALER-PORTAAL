import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Eraser, RotateCcw, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * 🧽 Manual Magic Eraser — geen AI, geen credits.
 * Gebruikt een transparante overlay-canvas bovenop de foto (geen CORS-issues).
 *
 * Props:
 *  - open, onClose
 *  - imageUrl: bron-foto
 *  - onDone: callback met nieuwe cache-buster timestamp
 */
const ManualInpaintModal = ({ open, onClose, imageUrl, onDone }) => {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [brushSize, setBrushSize] = useState(30);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  // Result-preview state (slider before/after)
  const [resultUrl, setResultUrl] = useState(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [undoing, setUndoing] = useState(false);
  // Stable cache-buster — gegenereerd 1× per modal-open zodat de img niet herlaadt bij re-renders
  const [openTs, setOpenTs] = useState(0);

  // Wait until image is loaded → size canvas accordingly
  useEffect(() => {
    if (!open) {
      setImgLoaded(false);
      setImgError(false);
      setHasMask(false);
      setResultUrl(null);
      setSliderPos(50);
      setOpenTs(0);
    } else {
      // Genereer 1× cache-buster per open
      setOpenTs(Date.now());
    }
  }, [open]);

  const handleImgError = () => {
    console.error('[Inpaint] Failed to load image:', imageUrl);
    setImgError(true);
  };

  const handleImgLoad = (e) => {
    // Voorkom dubbele initialisatie (wist je tekening niet bij re-render)
    if (imgLoaded) return;
    const img = e.target;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    const maxW = Math.min(900, window.innerWidth - 80);
    const scale = Math.min(1, maxW / natW);
    const dispW = Math.round(natW * scale);
    const dispH = Math.round(natH * scale);
    setImgSize({ w: natW, h: natH });
    setDisplaySize({ w: dispW, h: dispH });
    // Sync canvas to displayed image dimensions
    const c = canvasRef.current;
    if (c) {
      c.width = dispW;
      c.height = dispH;
    }
    setImgLoaded(true);
    setHasMask(false);
  };

  const getCanvasPoint = (e) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    const scaleX = c.width / rect.width;
    const scaleY = c.height / rect.height;
    const cx = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
    const cy = (e.clientY ?? e.touches?.[0]?.clientY) - rect.top;
    return { x: cx * scaleX, y: cy * scaleY };
  };

  const startDraw = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    drawAt(e, true);
  };

  const drawAt = (e, force = false) => {
    if (!force && !isDrawing) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const { x, y } = getCanvasPoint(e);
    ctx.fillStyle = 'rgba(255, 0, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();
    setHasMask(true);
  };

  const stopDraw = () => setIsDrawing(false);

  const resetCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setHasMask(false);
  };

  const extractImageId = (url) => {
    if (!url) return '';
    return url.split('/api/images/').pop().split('?')[0].split('.')[0];
  };

  const handleUndo = async () => {
    const imageId = extractImageId(imageUrl);
    if (!imageId) return;
    setUndoing(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/images/${imageId}/undo-inpaint`,
        {},
        { headers: { Authorization: `Bearer ${token}` }, timeout: 30000 }
      );
      toast.success('↶ Ongedaan gemaakt');
      if (onDone) onDone(Date.now());
      onClose();
    } catch (err) {
      console.error('Undo error:', err);
      toast.error(err.response?.data?.detail || 'Ongedaan maken mislukt');
    } finally {
      setUndoing(false);
    }
  };

  /**
   * Build a black/white PNG mask at DISPLAY resolution (kleinere upload).
   * Backend schaalt op naar natural. Bespaart 90% upload-size.
   */
  const buildMaskPng = () => {
    const c = canvasRef.current;
    if (!c) return null;
    const overlayData = c.getContext('2d').getImageData(0, 0, c.width, c.height);

    // Mask op display-resolutie (kleiner = sneller uploaden)
    const m = document.createElement('canvas');
    m.width = c.width;
    m.height = c.height;
    const mctx = m.getContext('2d');
    mctx.fillStyle = 'black';
    mctx.fillRect(0, 0, m.width, m.height);
    const out = mctx.getImageData(0, 0, m.width, m.height);
    for (let i = 0; i < overlayData.data.length; i += 4) {
      if (overlayData.data[i + 3] > 10) {
        out.data[i] = 255;
        out.data[i + 1] = 255;
        out.data[i + 2] = 255;
        out.data[i + 3] = 255;
      } else {
        out.data[i + 3] = 255;
      }
    }
    mctx.putImageData(out, 0, 0);
    return m.toDataURL('image/png');
  };

  const handleApply = async () => {
    if (!hasMask) {
      toast.error('Teken eerst over het logo dat je wil verwijderen');
      return;
    }
    const imageId = extractImageId(imageUrl);
    if (!imageId) {
      toast.error('Image-ID niet gevonden');
      return;
    }
    setSaving(true);
    try {
      const mask = buildMaskPng();
      if (!mask) {
        toast.error('Kon mask niet bouwen — probeer opnieuw te tekenen');
        setSaving(false);
        return;
      }
      const token = localStorage.getItem('token');
      const url = `${API}/images/${imageId}/inpaint-manual`;
      console.log('[Inpaint] POST', url, '| mask size:', Math.round(mask.length / 1024), 'KB');
      // 1) Start async job
      const startRes = await axios.post(
        url,
        { mask_base64: mask },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 30000 }
      );
      const jobId = startRes.data?.job_id;
      if (!jobId) throw new Error('Geen job_id ontvangen');
      console.log('[Inpaint] job started:', jobId);

      // 2) Poll for completion (max 5 min — production cloud-IO kan langzaam zijn)
      const maxAttempts = 150; // 150 × 2s = 300s = 5 min
      let finalStatus = null;
      let lastError = null;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const st = await axios.get(`${API}/inpaint-jobs/${jobId}`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000,
          });
          const s = st.data?.status;
          if (s === 'completed') { finalStatus = 'completed'; break; }
          if (s === 'failed') { finalStatus = 'failed'; lastError = st.data?.error; break; }
        } catch (pe) {
          console.warn('[Inpaint] poll error, retry...', pe.message);
        }
      }
      if (finalStatus === 'completed') {
        toast.success('🧽 Logo weggegumd!');
        setResultUrl(`${imageUrl}?v=${Date.now()}`);
        if (onDone) onDone(Date.now());
      } else if (finalStatus === 'failed') {
        toast.error(lastError || 'Gum-actie mislukt');
      } else {
        toast.error('Time-out: gum-job duurde te lang (>5 min)');
      }
    } catch (err) {
      console.error('Manual inpaint error:', err.response?.status, err.response?.data, err.message);
      const detail = err.response?.data?.detail;
      const status = err.response?.status;
      let msg = 'Gum-actie mislukt';
      if (detail) msg = `${detail} (HTTP ${status || '?'})`;
      else if (status === 404) msg = 'Endpoint niet gevonden — check deploy';
      else if (err.message) msg = err.message;
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-fuchsia-600" />
            Handmatige Magische Gum (gratis)
          </DialogTitle>
          <DialogDescription>
            Teken met de kwast over het logo. Klik op &quot;Toepassen&quot; om het gemaskerde gebied te vullen met omliggende pixels.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {resultUrl ? (
            /* RESULT VIEW: before/after slider */
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
                ✅ <strong>Klaar!</strong> Sleep de slider om vóór/na te vergelijken. Niet tevreden? Klik &quot;Ongedaan maken&quot;.
              </div>
              <div
                className="relative border-2 border-zinc-200 rounded-lg overflow-hidden bg-zinc-100 select-none"
                style={{ width: displaySize.w || '100%', height: displaySize.h || 'auto', margin: '0 auto' }}
              >
                {/* AFTER (full, behind) */}
                <img src={resultUrl} alt="Na" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                {/* BEFORE (clipped to slider position) */}
                <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
                  <img src={imageUrl} alt="Voor" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                </div>
                {/* Slider line + handle */}
                <div className="absolute top-0 bottom-0 w-1 bg-white pointer-events-none" style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-lg border-2 border-fuchsia-600 flex items-center justify-center text-fuchsia-600 font-bold text-xs">⇆</div>
                </div>
                {/* Labels */}
                <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">VOOR</div>
                <div className="absolute top-2 right-2 bg-emerald-600 text-white text-xs px-2 py-1 rounded">NA</div>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={sliderPos}
                onChange={(e) => setSliderPos(parseInt(e.target.value, 10))}
                className="w-full"
                data-testid="before-after-slider"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleUndo} disabled={undoing} data-testid="undo-inpaint-btn">
                  {undoing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                  Ongedaan maken
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={onClose} data-testid="confirm-inpaint-btn">
                  ✓ Bevestigen
                </Button>
              </div>
            </div>
          ) : (
          <>
          <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
            <label className="text-sm font-semibold whitespace-nowrap">Kwast:</label>
            <input
              type="range"
              min="5"
              max="80"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
              className="flex-1"
              data-testid="brush-size-slider"
            />
            <span className="text-xs text-zinc-500 w-10 text-right">{brushSize}px</span>
            <Button type="button" variant="outline" size="sm" onClick={resetCanvas} disabled={!hasMask}>
              <RotateCcw className="w-3 h-3 mr-1" /> Reset
            </Button>
          </div>

          <div className="border-2 border-zinc-200 rounded-lg overflow-hidden bg-zinc-100 flex justify-center min-h-[200px]">
            {imgError ? (
              <div className="p-8 text-center text-red-600">
                <p className="font-semibold">Foto kon niet geladen worden</p>
                <p className="text-xs text-zinc-500 mt-1">Controleer of de foto-URL bereikbaar is. Sluit dit venster en probeer opnieuw.</p>
              </div>
            ) : (
            <div
              className="relative"
              style={{ width: displaySize.w || 'auto', height: displaySize.h || 'auto' }}
            >
              <img
                ref={imgRef}
                src={imageUrl && openTs ? `${imageUrl}?v=${openTs}` : ''}
                alt="Te bewerken foto"
                onLoad={handleImgLoad}
                onError={handleImgError}
                style={{
                  display: 'block',
                  width: displaySize.w || 'auto',
                  height: displaySize.h || 'auto',
                  maxWidth: '100%',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
                draggable={false}
              />
              {imgLoaded && (
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDraw}
                  onMouseMove={drawAt}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDraw}
                  onTouchMove={drawAt}
                  onTouchEnd={stopDraw}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: displaySize.w,
                    height: displaySize.h,
                    cursor: 'crosshair',
                    touchAction: 'none',
                  }}
                  data-testid="inpaint-canvas"
                />
              )}
            </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Annuleren</Button>
            <Button
              type="button"
              className="bg-fuchsia-600 hover:bg-fuchsia-700"
              onClick={handleApply}
              disabled={saving || !hasMask}
              data-testid="apply-inpaint-btn"
            >
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Bezig...</> : <><Eraser className="w-4 h-4 mr-2" /> Toepassen</>}
            </Button>
          </div>
          </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManualInpaintModal;
