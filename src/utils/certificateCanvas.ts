import { jsPDF } from 'jspdf';

export const CERTIFICATE_BG_URL = '/assets/aistudio/image_1e425bd3.png';

let cachedCleanBg: HTMLCanvasElement | null = null;
let bgImagePromise: Promise<HTMLImageElement> | null = null;

function loadBackgroundImage(): Promise<HTMLImageElement> {
  if (bgImagePromise) return bgImagePromise;

  bgImagePromise = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      bgImagePromise = null;
      reject(new Error('Unable to load the original certificate background image.'));
    };
    img.src = CERTIFICATE_BG_URL;
  });

  return bgImagePromise;
}

/**
 * Rotates the uploaded certificate image upright (-90 deg) and cleanly removes
 * the original top-10 / team printed statement lines while preserving all logos,
 * borders, STARTATHON 2026 artwork, campus watermark, student silhouettes, and signatures.
 */
async function getCleanCertificateBackground(): Promise<HTMLCanvasElement> {
  if (cachedCleanBg) return cachedCleanBg;

  const img = await loadBackgroundImage();

  // Rotate -90 deg CCW into upright landscape (1524 x 1037)
  const w = img.height;
  const h = img.width;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context is unavailable.');

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();

  // Surgical text-removal region covering only the old body statement & underlines
  const x0 = Math.round(w * 0.058);
  const x1 = Math.round(w * 0.96);
  const y0 = Math.round(h * 0.448); // ~465px (right below STARTATHON 2026 splash)
  const y1 = Math.round(h * 0.774); // ~803px (safely above all 3 signatures)

  const regionW = x1 - x0;
  const regionH = y1 - y0;
  const imgData = ctx.getImageData(x0, y0, regionW, regionH);
  const data = imgData.data;

  // Build coarse local paper luminance grid (26x26px blocks, 70th percentile bright pixels)
  const cell = 26;
  const cols = Math.ceil(regionW / cell);
  const rows = Math.ceil(regionH / cell);
  const grid = new Float32Array(cols * rows);

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const sx0 = gx * cell;
      const sy0 = gy * cell;
      const sx1 = Math.min(regionW, sx0 + cell);
      const sy1 = Math.min(regionH, sy0 + cell);
      const lums: number[] = [];

      for (let py = sy0; py < sy1; py += 2) {
        for (let px = sx0; px < sx1; px += 2) {
          const i = (py * regionW + px) * 4;
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          if (lum > 165) {
            lums.push(lum);
          }
        }
      }

      if (lums.length > 0) {
        lums.sort((a, b) => a - b);
        grid[gy * cols + gx] = lums[Math.floor(lums.length * 0.65)];
      } else {
        grid[gy * cols + gx] = 230;
      }
    }
  }

  const sampleLocalBg = (px: number, py: number): number => {
    const gx = Math.min(cols - 1, Math.floor(px / cell));
    const gy = Math.min(rows - 1, Math.floor(py / cell));
    return grid[gy * cols + gx];
  };

  // Protected artwork geometry inside region coordinates:
  // 1) Cheering students silhouette on far bottom-left (absX < 306, absY > 685)
  // 2) Bottom edge of STARTATHON 2026 blue brush splash (absX in 575..1075, absY < 473)
  const isProtectedArtwork = (px: number, py: number): boolean => {
    const absX = x0 + px;
    const absY = y0 + py;
    if (absX < 306 && absY > 685) return true;
    if (absX > 575 && absX < 1075 && absY < 473) return true;
    return false;
  };

  // Detect ink pixels (both dark black/navy text and blue anti-aliased letter edges)
  const rawInk = new Uint8Array(regionW * regionH);
  for (let py = 0; py < regionH; py++) {
    for (let px = 0; px < regionW; px++) {
      if (isProtectedArtwork(px, py)) continue;

      const i = (py * regionW + px) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const localBg = sampleLocalBg(px, py);
      const blueExcess = b - r;

      const isDarkText = lum < 176 && localBg - lum > 34;
      const isBlueTextFringe = blueExcess > 26 && lum < 212 && localBg - lum > 18;

      if (isDarkText || isBlueTextFringe) {
        rawInk[py * regionW + px] = 1;
      }
    }
  }

  // Dilate mask by 2px radius to cover anti-aliased letter fringes cleanly
  const dilated = new Uint8Array(regionW * regionH);
  for (let py = 0; py < regionH; py++) {
    for (let px = 0; px < regionW; px++) {
      if (!rawInk[py * regionW + px]) continue;
      for (let dy = -2; dy <= 2; dy++) {
        const ny = py + dy;
        if (ny < 0 || ny >= regionH) continue;
        for (let dx = -2; dx <= 2; dx++) {
          if (dx * dx + dy * dy > 5) continue;
          const nx = px + dx;
          if (nx < 0 || nx >= regionW) continue;
          if (isProtectedArtwork(nx, ny)) continue;
          dilated[ny * regionW + nx] = 1;
        }
      }
    }
  }

  // Inverse-distance weighted 8-directional fill from clean background pixels
  const out = new Uint8ClampedArray(data);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];
  const maxReach = 34;

  for (let py = 0; py < regionH; py++) {
    for (let px = 0; px < regionW; px++) {
      const idx = py * regionW + px;
      if (!dilated[idx]) continue;

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let wSum = 0;

      for (let d = 0; d < dirs.length; d++) {
        const dx = dirs[d][0];
        const dy = dirs[d][1];
        for (let step = 1; step <= maxReach; step++) {
          const sx = px + dx * step;
          const sy = py + dy * step;
          if (sx < 0 || sx >= regionW || sy < 0 || sy >= regionH) break;
          if (!dilated[sy * regionW + sx]) {
            const cIdx = (sy * regionW + sx) * 4;
            const dist = Math.hypot(dx * step, dy * step);
            const weight = 1 / (dist * dist + 0.5);
            rSum += data[cIdx] * weight;
            gSum += data[cIdx + 1] * weight;
            bSum += data[cIdx + 2] * weight;
            wSum += weight;
            break;
          }
        }
      }

      if (wSum > 0) {
        const outIdx = idx * 4;
        const grain = (((px * 73856093) ^ (py * 19349663)) & 3) - 1.5;
        out[outIdx] = Math.min(255, Math.max(0, Math.round(rSum / wSum + grain)));
        out[outIdx + 1] = Math.min(255, Math.max(0, Math.round(gSum / wSum + grain)));
        out[outIdx + 2] = Math.min(255, Math.max(0, Math.round(bSum / wSum + grain)));
      }
    }
  }

  imgData.data.set(out);
  ctx.putImageData(imgData, x0, y0);

  // Upscale smoothly to 1.5x (2286 x 1555) for crisp typography & high-res downloads
  const hiResW = Math.round(w * 1.5);
  const hiResH = Math.round(h * 1.5);
  const hiCanvas = document.createElement('canvas');
  hiCanvas.width = hiResW;
  hiCanvas.height = hiResH;
  const hiCtx = hiCanvas.getContext('2d');
  if (!hiCtx) throw new Error('Unable to create high-resolution canvas context.');
  hiCtx.imageSmoothingEnabled = true;
  hiCtx.imageSmoothingQuality = 'high';
  hiCtx.drawImage(canvas, 0, 0, hiResW, hiResH);

  cachedCleanBg = hiCanvas;
  return hiCanvas;
}

interface TextToken {
  text: string;
  isBold: boolean;
  isSpace: boolean;
}

function buildParticipationTokens(
  studentName: string,
  department: string
): TextToken[] {
  const cleanName = studentName.trim().toUpperCase();
  const cleanDept = department.trim();

  const segments: { text: string; isBold: boolean }[] = [
    { text: 'This is to certify that Mr./Ms. ', isBold: false },
    { text: cleanName, isBold: true },
    { text: ' of ', isBold: false },
    { text: cleanDept, isBold: true },
    {
      text: " Department has actively participated in STARTATHON 2026, conducted by the Students' Council of St. Joseph's College of Engineering on 25.09.2026.",
      isBold: false,
    },
  ];

  const tokens: TextToken[] = [];
  for (const seg of segments) {
    const parts = seg.text.split(/(\s+)/);
    for (const part of parts) {
      if (part.length === 0) continue;
      tokens.push({
        text: part,
        isBold: seg.isBold,
        isSpace: /^\s+$/.test(part),
      });
    }
  }
  return tokens;
}

export async function renderParticipationCertificate(
  targetCanvas: HTMLCanvasElement,
  fullName: string,
  department: string
): Promise<void> {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const bgCanvas = await getCleanCertificateBackground();
  const width = bgCanvas.width;
  const height = bgCanvas.height;

  targetCanvas.width = width;
  targetCanvas.height = height;

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) throw new Error('Unable to acquire 2D canvas context.');

  ctx.drawImage(bgCanvas, 0, 0);

  const tokens = buildParticipationTokens(fullName, department);

  // Clean safe text area: centered horizontally (shifted slightly right on lower half
  // to stay clear of bottom-left silhouettes), spanning y = 47.5% to 75%
  const maxWidth = width * 0.72;
  const centerX = width * 0.515;
  const zoneTopY = height * 0.478;
  const zoneHeight = height * 0.27;

  // Automatically pick optimal font size so even long names/departments fit comfortably
  let fontSize = Math.round(width * 0.0218); // ~50px on 2286px canvas
  const minFontSize = Math.round(width * 0.016);
  let lines: { tokens: (TextToken & { width: number; font: string })[]; width: number }[] = [];
  let lineHeightPx = fontSize * 1.66;

  while (fontSize >= minFontSize) {
    lineHeightPx = fontSize * 1.66;
    const candidateLines: typeof lines = [];
    let currentLine: (TextToken & { width: number; font: string })[] = [];
    let currentWidth = 0;

    for (const tok of tokens) {
      const font = tok.isBold
        ? `700 ${fontSize}px "Lora", Georgia, serif`
        : `500 ${fontSize}px "Lora", Georgia, serif`;
      ctx.font = font;
      const tokWidth = ctx.measureText(tok.text).width;

      if (currentLine.length === 0 && tok.isSpace) continue;

      if (!tok.isSpace && currentLine.length > 0 && currentWidth + tokWidth > maxWidth) {
        while (currentLine.length > 0 && currentLine[currentLine.length - 1].isSpace) {
          currentWidth -= currentLine.pop()!.width;
        }
        candidateLines.push({ tokens: currentLine, width: currentWidth });
        currentLine = [{ ...tok, width: tokWidth, font }];
        currentWidth = tokWidth;
      } else {
        currentLine.push({ ...tok, width: tokWidth, font });
        currentWidth += tokWidth;
      }
    }

    if (currentLine.length > 0) {
      while (currentLine.length > 0 && currentLine[currentLine.length - 1].isSpace) {
        currentWidth -= currentLine.pop()!.width;
      }
      if (currentLine.length > 0) {
        candidateLines.push({ tokens: currentLine, width: currentWidth });
      }
    }

    const totalBlockHeight = candidateLines.length * lineHeightPx;
    if (totalBlockHeight <= zoneHeight || fontSize === minFontSize) {
      lines = candidateLines;
      break;
    }
    fontSize -= 2;
  }

  const totalHeight = lines.length * lineHeightPx;
  const startY = zoneTopY + Math.max(0, (zoneHeight - totalHeight) * 0.42);

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  lines.forEach((line, idx) => {
    const y = startY + idx * lineHeightPx;
    let x = centerX - line.width / 2;

    for (const tok of line.tokens) {
      ctx.font = tok.font;
      ctx.fillStyle = tok.isBold ? '#0f172a' : '#1e293b';
      ctx.fillText(tok.text, x, y);
      x += tok.width;
    }
  });
}

function buildSafeFilename(fullName: string, ext: 'png' | 'pdf'): string {
  const slug = fullName
    .trim()
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50);
  return `STARTATHON_2026_Certificate_${slug || 'Participant'}.${ext}`;
}

export function downloadCanvasAsPng(
  canvas: HTMLCanvasElement,
  fullName: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to generate PNG file.'));
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = buildSafeFilename(fullName, 'png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 3000);
        resolve();
      },
      'image/png',
      1.0
    );
  });
}

export function downloadCanvasAsPdf(
  canvas: HTMLCanvasElement,
  fullName: string
): void {
  const pdfW = 297; // A4 landscape width in mm
  const pdfH = Number(((canvas.height / canvas.width) * pdfW).toFixed(2));
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [pdfW, pdfH],
    compress: true,
  });

  const dataUrl = canvas.toDataURL('image/png');
  pdf.addImage(dataUrl, 'PNG', 0, 0, pdfW, pdfH, undefined, 'FAST');
  pdf.save(buildSafeFilename(fullName, 'pdf'));
}
