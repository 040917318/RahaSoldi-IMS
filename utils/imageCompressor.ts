/**
 * Client-side image compression and camera capture utilities for Product Images.
 * Resizes images to balanced dimensions (max 640px) and compresses to lightweight JPEG (~30-60KB)
 * so it stays snappy, fits cleanly into browser local storage cache and database sync.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 640,
  maxHeight: 640,
  quality: 0.82
};

/**
 * Resizes and compresses an image file to a compact base64 JPEG data URL.
 */
export async function compressImageFile(
  file: File | Blob,
  options: CompressionOptions = DEFAULT_OPTIONS
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    // If not an image, reject
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
          const maxW = opts.maxWidth || 640;
          const maxH = opts.maxHeight || 640;

          if (width > maxW || height > maxH) {
            const ratio = Math.min(maxW / width, maxH / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;

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
          ctx.fillRect(0, 0, width, height);

          ctx.drawImage(img, 0, 0, width, height);

          // Convert to JPEG data URI
          const compressedDataUrl = canvas.toDataURL('image/jpeg', opts.quality || 0.82);
          resolve(compressedDataUrl);
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
 * and returns the compressed base64 JPEG data URL.
 */
export function captureVideoFrame(
  video: HTMLVideoElement,
  options: CompressionOptions = DEFAULT_OPTIONS
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const canvas = document.createElement('canvas');

  let width = video.videoWidth || 640;
  let height = video.videoHeight || 480;

  const maxW = opts.maxWidth || 640;
  const maxH = opts.maxHeight || 640;

  if (width > maxW || height > maxH) {
    const ratio = Math.min(maxW / width, maxH / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context unavailable for camera snapshot');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw current video frame
  ctx.drawImage(video, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', opts.quality || 0.82);
}
