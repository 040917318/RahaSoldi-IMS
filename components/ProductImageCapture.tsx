import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Trash2, RefreshCw, X, Check, Image as ImageIcon, AlertCircle, Sparkles, Sliders, CheckCircle2 } from 'lucide-react';
import { 
  compressImageFile, 
  captureVideoFrame, 
  QualityMode, 
  CompressionResult, 
  QUALITY_PRESETS,
  formatFileSize,
  getBase64ByteSize
} from '../utils/imageCompressor';

interface ProductImageCaptureProps {
  currentImageUrl?: string;
  onImageChange: (imageUrl?: string) => void;
  label?: string;
  disabled?: boolean;
}

export const ProductImageCapture: React.FC<ProductImageCaptureProps> = ({
  currentImageUrl,
  onImageChange,
  label = 'Product Picture',
  disabled = false
}) => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [tempCapturedImage, setTempCapturedImage] = useState<string | null>(null);
  const [tempCaptureResult, setTempCaptureResult] = useState<CompressionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Quality Mode & Optimization State
  const [qualityMode, setQualityMode] = useState<QualityMode>('standard');
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [compressionStats, setCompressionStats] = useState<{
    original: string;
    compressed: string;
    savings: number;
    width: number;
    height: number;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera when unmounting or when camera is deactivated
  const stopCameraStream = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [cameraStream]);

  // Start Camera Stream
  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    setCameraError(null);
    setTempCapturedImage(null);
    setTempCaptureResult(null);
    setIsProcessing(true);

    // Stop any existing stream first
    stopCameraStream();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      setIsCameraActive(true);
      setFacingMode(mode);

      // Attach stream to video element
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((e) => console.warn('Video play warning:', e));
        }
      }, 50);
    } catch (err: any) {
      console.error('Camera error:', err);
      let message = 'Unable to access camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Camera permission was denied. Please allow camera permissions in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No camera device found on this system.';
      } else if (err.name === 'NotReadableError') {
        message = 'Camera is currently in use by another app.';
      }
      setCameraError(message);
      setIsCameraActive(true); // Open modal to show error
    } finally {
      setIsProcessing(false);
    }
  };

  // Switch between back and front camera
  const toggleCameraFacing = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    await startCamera(nextMode);
  };

  // Close Camera
  const closeCamera = () => {
    stopCameraStream();
    setIsCameraActive(false);
    setTempCapturedImage(null);
    setTempCaptureResult(null);
    setCameraError(null);
  };

  // Take Snapshot from live video feed
  const handleSnapPhoto = () => {
    if (!videoRef.current) return;
    try {
      const snapResult = captureVideoFrame(videoRef.current, { qualityMode });
      setTempCapturedImage(snapResult.dataUrl);
      setTempCaptureResult(snapResult);
      // Stop video while previewing captured photo
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    } catch (err: any) {
      setCameraError(err.message || 'Failed to capture photo frame.');
    }
  };

  // Accept snapshot
  const handleConfirmCapturedPhoto = () => {
    if (tempCapturedImage) {
      onImageChange(tempCapturedImage);
      if (tempCaptureResult) {
        setCompressionStats({
          original: tempCaptureResult.formattedOriginalSize,
          compressed: tempCaptureResult.formattedCompressedSize,
          savings: tempCaptureResult.savingsPercent,
          width: tempCaptureResult.width,
          height: tempCaptureResult.height
        });
      }
      closeCamera();
    }
  };

  // Retake photo
  const handleRetakePhoto = () => {
    setTempCapturedImage(null);
    setTempCaptureResult(null);
    startCamera(facingMode);
  };

  // Process file with compression
  const processAndCompressFile = async (file: File, mode: QualityMode) => {
    try {
      setIsProcessing(true);
      setUploadError(null);
      const res = await compressImageFile(file, { qualityMode: mode });
      onImageChange(res.dataUrl);
      setCompressionStats({
        original: res.formattedOriginalSize,
        compressed: res.formattedCompressedSize,
        savings: res.savingsPercent,
        width: res.width,
        height: res.height
      });
    } catch (err: any) {
      console.error('Compression error:', err);
      setUploadError(err.message || 'Failed to process and compress selected image');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle File Input from disk/gallery
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLastFile(file);
    await processAndCompressFile(file, qualityMode);
  };

  // Handle Quality Mode Change
  const handleQualityChange = async (mode: QualityMode) => {
    setQualityMode(mode);
    if (lastFile) {
      await processAndCompressFile(lastFile, mode);
    }
  };

  const handleRemoveImage = () => {
    onImageChange(undefined);
    setLastFile(null);
    setCompressionStats(null);
    setUploadError(null);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          {label}
        </label>
        
        {/* Quality Mode Toggle */}
        <div className="flex items-center gap-1.5 text-xs">
          <Sliders className="w-3 h-3 text-slate-400" />
          <div className="inline-flex rounded-lg bg-slate-200/80 dark:bg-slate-700/80 p-0.5">
            <button
              type="button"
              disabled={disabled || isProcessing}
              onClick={() => handleQualityChange('standard')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                qualityMode === 'standard'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
              title="Standard quality (recommended): ~40–80KB for maximum speed & memory savings"
            >
              Standard
            </button>
            <button
              type="button"
              disabled={disabled || isProcessing}
              onClick={() => handleQualityChange('high')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                qualityMode === 'high'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
              title="High quality: ~120–180KB for high resolution product details"
            >
              High Quality
            </button>
          </div>
        </div>
      </div>

      {/* Main Image Selector Box */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
        {/* Thumbnail Preview Area */}
        <div className="relative group shrink-0">
          {currentImageUrl ? (
            <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-900">
              <img
                src={currentImageUrl}
                alt="Product preview"
                className="w-full h-full object-cover cursor-pointer transition-transform duration-200 group-hover:scale-105"
                onClick={() => setShowPreviewModal(true)}
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                disabled={disabled}
                className="absolute top-1 right-1 p-1 bg-red-600/90 hover:bg-red-700 text-white rounded-full shadow transition-all opacity-90 group-hover:opacity-100"
                title="Remove photo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="w-20 h-20 rounded-lg bg-slate-200/80 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
              <ImageIcon className="w-8 h-8 stroke-[1.5]" />
              <span className="text-[10px] mt-1 font-medium text-slate-400">No Image</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex-1 space-y-2 w-full">
          <div className="flex flex-wrap items-center gap-2">
            {/* Upload from device / gallery */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={disabled || isProcessing}
            />
            <button
              type="button"
              disabled={disabled || isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 shadow-sm transition-colors disabled:opacity-50"
            >
              {isProcessing ? (
                <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              )}
              <span>{isProcessing ? 'Compressing...' : (currentImageUrl ? 'Replace Photo' : 'Upload Photo')}</span>
            </button>

            {/* Take Photo with Camera */}
            <button
              type="button"
              disabled={disabled || isProcessing}
              onClick={() => startCamera('environment')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors disabled:opacity-50"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Take Photo</span>
            </button>

            {/* Remove button if image exists */}
            {currentImageUrl && (
              <button
                type="button"
                disabled={disabled || isProcessing}
                onClick={handleRemoveImage}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            )}
          </div>

          {/* Compression Savings & Telemetry Banner */}
          {compressionStats ? (
            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 px-2.5 py-1.5 rounded-lg text-xs font-mono tabular-nums">
              <div className="flex items-center gap-1.5 truncate">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">
                  Optimized: {compressionStats.original} → {compressionStats.compressed}
                </span>
              </div>
              <span className="shrink-0 ml-2 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded text-[10px]">
                -{compressionStats.savings}% saved
              </span>
            </div>
          ) : currentImageUrl ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>
                Memory size: ~{formatFileSize(getBase64ByteSize(currentImageUrl))} · Optimized for fast POS rendering
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              Automatic client-side compression reduces camera and disk photos to lightweight WebP/JPEG format to preserve memory.
            </p>
          )}

          {/* Inline Error Message */}
          {uploadError && (
            <div className="flex items-center justify-between bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 px-2.5 py-1.5 rounded-lg text-xs">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>{uploadError}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setUploadError(null)}
                className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-200 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Live Camera Capture Modal */}
      {isCameraActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 text-white">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-400" />
                <span className="font-semibold text-sm">Snap Product Photo</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  [{QUALITY_PRESETS[qualityMode].label}]
                </span>
              </div>
              <button
                type="button"
                onClick={closeCamera}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Viewfinder / Preview Area */}
            <div className="relative bg-black flex-1 min-h-[300px] flex items-center justify-center overflow-hidden">
              {cameraError ? (
                <div className="p-6 text-center max-w-sm space-y-3">
                  <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
                  <p className="text-sm text-slate-200 font-medium">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => startCamera(facingMode)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Camera
                  </button>
                </div>
              ) : tempCapturedImage ? (
                // Captured Photo Preview
                <div className="relative w-full h-full max-h-[460px] flex items-center justify-center bg-black">
                  <img
                    src={tempCapturedImage}
                    alt="Captured snapshot"
                    className="max-h-[460px] w-auto max-w-full object-contain"
                  />
                  <div className="absolute top-3 left-3 bg-emerald-500/90 text-white text-xs font-medium px-2.5 py-1 rounded-full backdrop-blur-sm shadow flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Snapshot Captured
                  </div>
                  {tempCaptureResult && (
                    <div className="absolute bottom-3 left-3 right-3 bg-black/75 backdrop-blur-md text-emerald-300 text-xs px-3 py-1.5 rounded-lg flex items-center justify-between border border-white/10 font-mono">
                      <span>Compressed: {tempCaptureResult.formattedCompressedSize}</span>
                      <span className="text-white/80">{tempCaptureResult.width}×{tempCaptureResult.height}px</span>
                    </div>
                  )}
                </div>
              ) : (
                // Live Video Stream
                <div className="relative w-full h-full flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-auto max-h-[460px] object-cover"
                  />
                  {/* Viewfinder Target Box Overlay */}
                  <div className="pointer-events-none absolute inset-8 border-2 border-emerald-400/50 rounded-xl flex items-center justify-center">
                    <span className="text-[11px] text-white/70 bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm">
                      Align product inside frame
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Controls / Footer */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
              {tempCapturedImage ? (
                <>
                  <button
                    type="button"
                    onClick={handleRetakePhoto}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retake
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCapturedPhoto}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg transition"
                  >
                    <Check className="w-4 h-4" />
                    Use Compressed Photo
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    disabled={!!cameraError}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition disabled:opacity-40"
                    title="Switch camera"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span className="hidden sm:inline">Flip Camera</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSnapPhoto}
                    disabled={!!cameraError}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-full shadow-lg transition transform active:scale-95 disabled:opacity-40"
                  >
                    <Camera className="w-5 h-5" />
                    <span>Capture Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={closeCamera}
                    className="px-3 py-2 text-xs text-slate-400 hover:text-white transition"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enlarged Photo Preview Lightbox */}
      {showPreviewModal && currentImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            className="relative max-w-xl w-full bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowPreviewModal(false)}
              className="absolute top-4 right-4 z-10 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={currentImageUrl}
              alt="Full size product preview"
              className="w-full h-auto max-h-[75vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Lightweight, reusable lightbox thumbnail component for tables & cards
 */
export const ProductThumbnail: React.FC<{
  imageUrl?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ imageUrl, name, size = 'md', className = '' }) => {
  const [showLightbox, setShowLightbox] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8 rounded-md text-xs',
    md: 'w-10 h-10 rounded-lg text-sm',
    lg: 'w-14 h-14 rounded-xl text-base'
  }[size];

  if (!imageUrl) {
    return (
      <div
        className={`${sizeClasses} bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center shrink-0 border border-slate-200/80 dark:border-slate-700/60 font-semibold ${className}`}
        title={`No image for ${name}`}
      >
        <ImageIcon className={size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-5 h-5' : 'w-6 h-6'} />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowLightbox(true)}
        className={`${sizeClasses} relative overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 shadow-xs hover:ring-2 hover:ring-indigo-500 transition-all cursor-zoom-in group ${className}`}
        title={`Click to view full image of ${name}`}
      >
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
          loading="lazy"
        />
      </button>

      {showLightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowLightbox(false)}
        >
          <div
            className="relative max-w-lg w-full bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl p-2 border border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-2">
              <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate pr-2">
                {name}
              </span>
              <button
                type="button"
                onClick={() => setShowLightbox(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={imageUrl}
              alt={name}
              className="w-full h-auto max-h-[70vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </>
  );
};
