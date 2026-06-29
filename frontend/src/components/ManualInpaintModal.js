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

  // Wait until image is loaded → size canvas accordingly
  useEffect(() => {
    if (!open) {
      setImgLoaded(false);
      setImgError(false);
      setHasMask(false);
    }
  }, [open]);

  const handleImgError = () => {
    console.error('[Inpaint] Failed to load image:', imageUrl);
    setImgError(true);
  };

  const handleImgLoad = (e) => {
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

  /**
   * Build a black/white PNG mask at the NATURAL image resolution.
   * Painted pixels (alpha > 0) → white. Rest → black.
   */
  const buildMaskPng = () => {
    const c = canvasRef.current;
    if (!c) return null;
    // Read the painted overlay (only contains user strokes — no CORS)
    const overlayData = c.getContext('2d').getImageData(0, 0, c.width, c.height);

    // Build mask at NATURAL resolution
    const m = document.createElement('canvas');
    m.width = imgSize.w;
    m.height = imgSize.h;
    const mctx = m.getContext('2d');
    mctx.fillStyle = 'black';
    mctx.fillRect(0, 0, m.width, m.height);

    // Build small white-mask from overlay alpha
    const smallMask = document.createElement('canvas');
    smallMask.width = c.width;
    smallMask.height = c.height;
    const smctx = smallMask.getContext('2d');
    const out = smctx.createImageData(c.width, c.height);
    for (let i = 0; i < overlayData.data.length; i += 4) {
      if (overlayData.data[i + 3] > 10) {
        out.data[i] = 255;
        out.data[i + 1] = 255;
        out.data[i + 2] = 255;
        out.data[i + 3] = 255;
      } else {
        out.data[i + 3] = 255; // black opaque
      }
    }
    smctx.putImageData(out, 0, 0);

    // Scale up to natural size
    mctx.imageSmoothingEnabled = false;
    mctx.drawImage(smallMask, 0, 0, m.width, m.height);
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
      await axios.post(
        url,
        { mask_base64: mask },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 }
      );
      toast.success('🧽 Logo weggegumd!');
      if (onDone) onDone(Date.now());
      onClose();
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
                src={imageUrl ? `${imageUrl}?v=${(open && imageUrl) ? Date.now() : ''}` : ''}
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManualInpaintModal;
