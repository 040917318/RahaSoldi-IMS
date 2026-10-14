/**
 * Client-side image compression and camera capture utilities for Product Images.
 * Resizes images and compresses to lightweight formats (WebP/JPEG)
 * so it stays snappy, fits cleanly into browser local storage cache and database sync.
 */

export type QualityMode = 'standard' | 'high';

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0
  qualityMode?: QualityMode;
}

export interface CompressionResult {
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  savingsPercent: number;
  formattedOriginalSize: string;
  formattedCompressedSize: string;
  width: number;
  height: number;
}

export const QUALITY_PRESETS: Record<QualityMode, { maxWidth: number; maxHeight: number; quality: number; label: string; description: string }> = {
  standard: {
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.76,
    label: 'Standard',
    description: 'Smart compression (~40–80 KB) for maximum speed & memory savings'
  },
  high: {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.88,
    label: 'High Quality',
    description: 'High-definition details (~100–180 KB) for zoomed viewing'
  }
};

/**
 * Format raw byte count into human-readable representation (e.g. 142 KB, 3.2 MB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${val} ${sizes[i]}`;
}

/**
 * Approximate the byte size of a base64 Data URL string
 */
export function getBase64ByteSize(dataUrl: string): number {
  if (!dataUrl) return 0;
  const commaIndex = dataUrl.indexOf(',');
  const base64Data = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  const padding = (base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0);
  return Math.max(0, Math.round((base64Data.length * 3) / 4 - padding));
}

/**
 * Resizes and compresses an image file to a compact base64 JPEG data URL,
 * returning full optimization telemetry.
 */
export async function compressImageFile(
  file: File | Blob,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const mode = options.qualityMode || 'standard';
  const preset = QUALITY_PRESETS[mode];

  const maxW = options.maxWidth || preset.maxWidth;
  const maxH = options.maxHeight || preset.maxHeight;
  const quality = options.quality !== undefined ? options.quality : preset.quality;

  const originalSize = file.size || 0;

  return new Promise((resolve, reject) => {
    if (file.type && !file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image in browser'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          // Scale down proportionally
          if (width > maxW || height > maxH) {
            const ratio = Math.min(maxW / width, maxH / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas 2D context not available'));
            return;
          }

          // Render with smooth anti-aliasing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // White background for PNG transparency conversion to JPEG
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Convert to JPEG data URI
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          const compressedSize = getBase64ByteSize(compressedDataUrl);

          const savings = originalSize > 0 
            ? Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100))
            : 0;

          resolve({
            dataUrl: compressedDataUrl,
            originalSize,
            compressedSize,
            savingsPercent: savings,
            formattedOriginalSize: formatFileSize(originalSize),
            formattedCompressedSize: formatFileSize(compressedSize),
            width: canvas.width,
            height: canvas.height
          });
        } catch (err) {
          reject(err);
        }
      };
      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Snaps a high-quality frame from a live HTMLVideoElement (camera feed)
 * and returns the compressed base64 JPEG data URL with metrics.
 */
export function captureVideoFrame(
  video: HTMLVideoElement,
  options: CompressionOptions = {}
): CompressionResult {
  const mode = options.qualityMode || 'standard';
  const preset = QUALITY_PRESETS[mode];

  const maxW = options.maxWidth || preset.maxWidth;
  const maxH = options.maxHeight || preset.maxHeight;
  const quality = options.quality !== undefined ? options.quality : preset.quality;

  const canvas = document.createElement('canvas');

  let width = video.videoWidth || 640;
  let height = video.videoHeight || 480;

  if (width > maxW || height > maxH) {
    const ratio = Math.min(maxW / width, maxH / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context unavailable for camera snapshot');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw current video frame
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const compressedSize = getBase64ByteSize(dataUrl);

  // Approximate uncompressed raw video buffer size: width * height * 3
  const approxRawSize = width * height * 3;
  const savings = approxRawSize > 0 
    ? Math.max(0, Math.round(((approxRawSize - compressedSize) / approxRawSize) * 100))
    : 0;

  return {
    dataUrl,
    originalSize: approxRawSize,
    compressedSize,
    savingsPercent: savings,
    formattedOriginalSize: formatFileSize(approxRawSize),
    formattedCompressedSize: formatFileSize(compressedSize),
    width: canvas.width,
    height: canvas.height
  };
}
