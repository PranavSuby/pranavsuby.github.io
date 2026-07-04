import { useState, useEffect, useRef } from 'react';
import { Camera, Loader } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';
import { getFoodByBarcode, saveFood } from './db';

// ZXing decodes barcodes in pure JS, so this works everywhere getUserMedia does —
// including iOS Safari and installed PWAs (the native BarcodeDetector API does not).
const SUPPORTED = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

// Product packaging uses 1-D retail barcodes. Restricting the reader to these
// formats (plus TRY_HARDER) makes decoding far faster and more reliable than the
// default "try every 1-D and 2-D format" mode.
const HINTS = new Map();
HINTS.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF,
]);
HINTS.set(DecodeHintType.TRY_HARDER, true);

async function lookupOpenFoodFacts(barcode) {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    const n = p.nutriments || {};
    return {
      name:        p.product_name || p.abbreviated_product_name || 'Unknown Product',
      brand:       p.brands || null,
      category:    'other',
      sourceDb:    'custom',
      barcode,
      kcal:        parseFloat(n['energy-kcal_100g'] || n['energy_kcal_100g'] || 0),
      proteinG:    parseFloat(n.proteins_100g       || 0),
      carbsG:      parseFloat(n.carbohydrates_100g  || 0),
      fatG:        parseFloat(n.fat_100g             || 0),
      fiberG:      parseFloat(n.fiber_100g           || 0),
      sugarG:      parseFloat(n.sugars_100g          || 0),
      sodiumMg:    parseFloat((n.sodium_100g         || 0) * 1000),
      servingSizeG: 100,
      isCustom:    false,
    };
  } catch {
    return null;
  }
}

export default function BarcodeScanner({ onFound, onNotFound }) {
  const [status,  setStatus]  = useState('idle'); // idle | scanning | loading | error
  const [message, setMessage] = useState('');
  const videoRef    = useRef(null);
  const controlsRef = useRef(null);
  const doneRef     = useRef(false);

  // Auto-start the camera as soon as the scanner opens — the user already chose to
  // scan, so there's no reason to make them tap a second button.
  useEffect(() => {
    if (SUPPORTED) startScan();
    return () => stopCamera();
  }, []);

  async function startScan() {
    if (!SUPPORTED) return;
    setStatus('scanning');
    setMessage('');
    doneRef.current = false;
    // Wait for React to actually mount the <video> before ZXing attaches to it. One
    // frame isn't always enough (the status→'scanning' render may not have committed),
    // which previously surfaced a spurious "couldn't open the camera" before the
    // permission prompt ever appeared. Poll a few frames instead.
    for (let i = 0; i < 30 && !videoRef.current; i++) {
      await new Promise(r => requestAnimationFrame(r));
    }
    if (!videoRef.current) { setStatus('error'); setMessage('Could not start the camera.'); return; }
    try {
      const reader = new BrowserMultiFormatReader(HINTS);
      // Ask for the rear camera at high resolution with continuous autofocus —
      // small/blurry frames are the main reason barcodes fail to decode. The
      // width/height/focus are "ideal"/advanced hints, so unsupported devices
      // just fall back instead of throwing.
      const controls = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: 'environment' },
            width:  { ideal: 1920 },
            height: { ideal: 1080 },
            advanced: [{ focusMode: 'continuous' }],
          },
        },
        videoRef.current,
        (result) => {
          if (result && !doneRef.current) {
            doneRef.current = true;
            const barcode = result.getText();
            stopCamera();
            handleBarcode(barcode);
          }
        }
      );
      controlsRef.current = controls;
    } catch (e) {
      setStatus('error');
      setMessage('Camera access denied or unavailable. Allow camera permission and try again.');
    }
  }

  async function handleBarcode(barcode) {
    setStatus('loading');
    setMessage(`Found barcode: ${barcode}`);

    // 1. Check local DB — flag it as scanned so it surfaces under "My Foods".
    let food = await getFoodByBarcode(barcode);
    if (food) {
      if (!food.scanned) { food = { ...food, scanned: true }; await saveFood(food); }
      onFound(food);
      return;
    }

    // 2. Fallback: Open Food Facts. Not persisted here — the result has no id and is
    // only saved by the caller when the user actually commits (logs / adds) it.
    setMessage('Looking up product…');
    food = await lookupOpenFoodFacts(barcode);
    if (food) {
      food.scanned = true;
      onFound(food);
      return;
    }

    setStatus('error');
    setMessage(`No product found for barcode ${barcode}. Try creating a custom food.`);
    setTimeout(() => onNotFound(barcode), 2000);
  }

  function stopCamera() {
    doneRef.current = true;
    try { controlsRef.current?.stop(); } catch {}
    controlsRef.current = null;
  }

  if (!SUPPORTED) {
    return (
      <div className="nc-barcode-unsupported">
        <Camera size={40} style={{ color: 'var(--nc-text3)', marginBottom: 12 }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--nc-text)', marginBottom: 6 }}>
          Camera not available
        </div>
        <div style={{ fontSize: 12, color: 'var(--nc-text3)', textAlign: 'center', lineHeight: 1.5 }}>
          This device or browser doesn’t allow camera access for scanning.
        </div>
      </div>
    );
  }

  return (
    <div className="nc-barcode-wrap">
      {status === 'idle' && (
        <div className="nc-barcode-idle">
          <Camera size={40} style={{ color: 'var(--nc-accent)', marginBottom: 16 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--nc-text)', marginBottom: 8 }}>
            Scan a barcode
          </div>
          <div style={{ fontSize: 12, color: 'var(--nc-text3)', marginBottom: 20, textAlign: 'center' }}>
            Point your camera at a food product barcode to look it up automatically.
          </div>
          <button className="nc-log-btn" style={{ width: 'auto', padding: '10px 28px' }} onClick={startScan}>
            Open Camera
          </button>
        </div>
      )}

      {(status === 'scanning' || status === 'loading') && (
        <div className="nc-barcode-scanner">
          <div className="nc-barcode-stage">
            <video
              ref={videoRef}
              className="nc-barcode-video"
              autoPlay playsInline muted
            />
            <div className="nc-barcode-viewfinder" />
            <div className="nc-barcode-hint">
              {status === 'loading'
                ? <><Loader size={14} className="nc-spin" /> {message}</>
                : 'Center the barcode in the frame'}
            </div>
          </div>
          <button
            className="nc-onboard-back"
            onClick={() => { stopCamera(); setStatus('idle'); }}
          >
            Cancel
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="nc-barcode-idle">
          <div style={{ fontSize: 13, color: 'var(--nc-warn)', textAlign: 'center', marginBottom: 16 }}>
            {message}
          </div>
          <button
            className="nc-log-btn"
            style={{ width: 'auto', padding: '10px 28px', background: 'var(--nc-surf2)', color: 'var(--nc-text)' }}
            onClick={() => setStatus('idle')}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
