import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Eraser, RotateCcw, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * 🧽 Manual Magic Eraser — geen AI, geen credits.
 * Props:
 *  - open, onClose
 *  - imageUrl: bron-foto (https://.../api/images/{id})
 *  - onDone: callback met nieuwe cache-buster timestamp
 */
const ManualInpaintModal = ({ open, onClose, imageUrl, onDone }) => {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [brushSize, setBrushSize] = useState(30);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load image into canvas
  useEffect(() => {
    if (!open || !imageUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = canvasRef.current;
      if (!c) return;
      const maxW = 900;
      const scale = Math.min(1, maxW / img.naturalWidth);
      c.width = img.naturalWidth * scale;
      c.height = img.naturalHeight * scale;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, c.width, c.height);
      imgRef.current = img;
      setHasMask(false);
    };
    img.onerror = () => toast.error('Kon afbeelding niet laden');
    img.src = `${imageUrl}?v=${Date.now()}`;
  }, [open, imageUrl]);

  const getCanvasPoint = (e) => {
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    const scaleX = c.width / rect.width;
    const scaleY = c.height / rect.height;
    const x = ((e.clientX ?? e.touches?.[0]?.clientX) - rect.left) * scaleX;
    const y = ((e.clientY ?? e.touches?.[0]?.clientY) - rect.top) * scaleY;
    return { x, y };
  };

  const startDraw = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    drawAt(e);
  };

  const drawAt = (e) => {
    if (!isDrawing && e.type !== 'mousedown' && e.type !== 'touchstart') return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const { x, y } = getCanvasPoint(e);
    ctx.fillStyle = 'rgba(255, 0, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();
    setHasMask(true);
  };

  const stopDraw = () => setIsDrawing(false);

  const resetCanvas = () => {
    const img = imgRef.current;
    const c = canvasRef.current;
    if (!img || !c) return;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, c.width, c.height);
    setHasMask(false);
  };

  // Extract image_id from URL
  const extractImageId = (url) => {
    if (!url) return '';
    return url.split('/api/images/').pop().split('?')[0].split('.')[0];
  };

  const buildMaskPng = () => {
    // Build a separate canvas where painted areas = white, rest = black
    const c = canvasRef.current;
    const img = imgRef.current;
    if (!c || !img) return null;
    const mask = document.createElement('canvas');
    mask.width = c.width;
    mask.height = c.height;
    const mctx = mask.getContext('2d');
    mctx.fillStyle = 'black';
    mctx.fillRect(0, 0, mask.width, mask.height);
    // Compare painted canvas vs original image — painted pixels = white in mask
    const painted = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    const orig = document.createElement('canvas');
    orig.width = c.width;
    orig.height = c.height;
    orig.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const origData = orig.getContext('2d').getImageData(0, 0, c.width, c.height);
    const maskData = mctx.getImageData(0, 0, mask.width, mask.height);
    for (let i = 0; i < painted.data.length; i += 4) {
      const dr = Math.abs(painted.data[i] - origData.data[i]);
      const dg = Math.abs(painted.data[i + 1] - origData.data[i + 1]);
      const db_ = Math.abs(painted.data[i + 2] - origData.data[i + 2]);
      // If significantly different = painted = inpaint
      if (dr + dg + db_ > 40) {
        maskData.data[i] = 255;
        maskData.data[i + 1] = 255;
        maskData.data[i + 2] = 255;
        maskData.data[i + 3] = 255;
      }
    }
    mctx.putImageData(maskData, 0, 0);
    return mask.toDataURL('image/png');
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
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/images/${imageId}/inpaint-manual`,
        { mask_base64: mask },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 }
      );
      toast.success('🧽 Logo weggegumd!');
      if (onDone) onDone(Date.now());
      onClose();
    } catch (err) {
      console.error('Manual inpaint error:', err);
      toast.error(err.response?.data?.detail || 'Gum-actie mislukt');
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
            Teken met de kwast over het logo. Klik op "Toepassen" om het gemaskerde gebied te vullen met omliggende pixels.
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

          <div className="border-2 border-zinc-200 rounded-lg overflow-hidden bg-zinc-100 flex justify-center">
            <canvas
              ref={canvasRef}
              onMouseDown={startDraw}
              onMouseMove={drawAt}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={drawAt}
              onTouchEnd={stopDraw}
              style={{ cursor: 'crosshair', maxWidth: '100%', touchAction: 'none' }}
              data-testid="inpaint-canvas"
            />
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
