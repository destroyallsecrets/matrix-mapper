
import React, { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { AlertTriangle, UploadCloud } from 'lucide-react';

interface RealityMapperProps {
  isScanning: boolean;
  mode: string;
  showColor: boolean;
  gridSize: number;
  enableZoom: boolean;
  sensitivity: number;
  refraction: number;
  diffusion: number;
  ambientLight: number;
  bloomThreshold: number;
  range: number;
  decayScale: number;
  streamTrailDecayScale: number;
  isEnhanced: boolean;
  luminanceModel: 'rec601' | 'average';
  edgeStrength: number;
  contrastGamma: number;
  rainInterference: number;
  showFeed: boolean;
  selectedDeviceId?: string;
  onStreamActive?: () => void;
  onExternalStateChange?: (isActive: boolean) => void;
  uploadedFile?: File | null;
  onFileDrop?: (file: File) => void;
  onTelemetryUpdate?: (stats: { fps: number; resolution: string; cells: number }) => void;
  cascadingRain?: boolean;
}

export interface RealityMapperHandle {
  getSnapshot: () => string | null;
  togglePiP: () => Promise<{ success: boolean; active?: boolean; reason?: string }>;
  startRecording: () => void;
  stopRecording: () => Promise<Blob | null>;
}

const RealityMapper = forwardRef<RealityMapperHandle, RealityMapperProps>((props, ref) => {
  const { 
    showColor, 
    gridSize, 
    sensitivity,
    decayScale,
    streamTrailDecayScale,
    selectedDeviceId,
    onStreamActive,
    uploadedFile,
    onFileDrop,
    onTelemetryUpdate,
    cascadingRain = false
  } = props;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Telemetry tracking
  const lastFpsTimeRef = useRef<number>(performance.now());
  const framesSampleRef = useRef<number>(0);

  // PiP Video Reference
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);

  // Performance-optimized buffers
  const energyBufferRef = useRef<Float32Array | null>(null);
  const prevLumaBufferRef = useRef<Float32Array | null>(null);
  const currentLumaBufferRef = useRef<Float32Array | null>(null);
  const dropsRef = useRef<Float32Array | null>(null); 
  const dropSpeedsRef = useRef<Float32Array | null>(null);
  const dropLengthsRef = useRef<Float32Array | null>(null);
  
  // Video processing pipeline
  const smallCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const smallCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  
  const [imageSource, setImageSource] = useState<HTMLImageElement | null>(null);

  // Recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  useImperativeHandle(ref, () => ({
    getSnapshot: () => {
      if (!canvasRef.current) return null;
      return canvasRef.current.toDataURL('image/png');
    },
    startRecording: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // @ts-ignore
      const stream = canvas.captureStream(30);
      try {
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };
        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
      } catch (e) {
        console.error("MediaRecorder error:", e);
        // Fallback for Safari/iOS
        try {
          const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/mp4' });
          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              recordedChunksRef.current.push(event.data);
            }
          };
          mediaRecorder.start();
          mediaRecorderRef.current = mediaRecorder;
        } catch (fallbackError) {
          console.error("MediaRecorder fallback error:", fallbackError);
        }
      }
    },
    stopRecording: () => {
      return new Promise((resolve) => {
        if (!mediaRecorderRef.current) {
          resolve(null);
          return;
        }
        mediaRecorderRef.current.onstop = () => {
          const mimeType = mediaRecorderRef.current?.mimeType || 'video/webm';
          const blob = new Blob(recordedChunksRef.current, { type: mimeType });
          recordedChunksRef.current = [];
          resolve(blob);
        };
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      });
    },
    togglePiP: async () => {
      try {
        if (!('pictureInPictureEnabled' in document) || !document.pictureInPictureEnabled) {
          return { success: false, reason: 'PiP unsupported in current browser or iframe context' };
        }

        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
          return { success: true, active: false };
        }

        const canvas = canvasRef.current;
        if (!canvas) {
          return { success: false, reason: 'Canvas not initialized' };
        }

        if (!pipVideoRef.current) {
          const video = document.createElement('video');
          video.muted = true;
          video.playsInline = true;
          video.autoplay = true;
          video.style.position = 'fixed';
          video.style.top = '-9999px';
          video.style.left = '-9999px';
          video.style.width = '1px';
          video.style.height = '1px';
          video.style.opacity = '0';
          video.style.pointerEvents = 'none';
          document.body.appendChild(video);
          pipVideoRef.current = video;
        }
        
        const pipVideo = pipVideoRef.current;
        // @ts-ignore
        const captureFn = canvas.captureStream || canvas.mozCaptureStream;
        if (captureFn && (!pipVideo.srcObject || !(pipVideo.srcObject as MediaStream).active)) {
          // @ts-ignore
          const stream = captureFn.call(canvas, 30);
          pipVideo.srcObject = stream;
        }
        
        await pipVideo.play().catch(() => {});
        await pipVideo.requestPictureInPicture();
        return { success: true, active: true };
      } catch (err: any) {
        console.warn("[Sight_OS PiP]:", err?.message || err);
        return { success: false, reason: err?.message || 'Failed to enter Picture-in-Picture' };
      }
    }
  }));

  useEffect(() => {
    if (!uploadedFile) {
      setImageSource(null);
      return;
    }

    if (uploadedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(uploadedFile);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        setImageSource(img);
      };
      return () => URL.revokeObjectURL(url);
    } else if (uploadedFile.type.startsWith('video/')) {
      if (videoRef.current) {
        const url = URL.createObjectURL(uploadedFile);
        videoRef.current.srcObject = null;
        videoRef.current.src = url;
        videoRef.current.loop = true;
        videoRef.current.play().catch(() => {});
        return () => URL.revokeObjectURL(url);
      }
    }
  }, [uploadedFile]);

  useEffect(() => {
    if (uploadedFile) return;

    let activeStream: MediaStream | null = null;
    let isCancelled = false;

    const initSensors = async () => {
      setCameraError(null);
      try {
        const vConstraints: MediaStreamConstraints = { 
          video: selectedDeviceId 
            ? { deviceId: { exact: selectedDeviceId } } 
            : { facingMode: { ideal: "environment" } }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(vConstraints);
        if (isCancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        
        // Try to apply advanced constraints if supported
        const track = stream.getVideoTracks()[0];
        if (track && 'applyConstraints' in track) {
          try {
            // @ts-ignore
            await track.applyConstraints({ exposureMode: 'manual' });
          } catch (e) {
            // Ignore if manual exposure is not supported
          }
        }

        activeStream = stream;
        if (videoRef.current) { 
          videoRef.current.srcObject = stream; 
          videoRef.current.play().catch(() => {}); 
          onStreamActive?.();
        }
      } catch (err: any) {
        console.error("Camera Init Error:", err);
        if (!isCancelled) setCameraError(err.name === 'NotAllowedError' ? "ACCESS DENIED" : "SENSOR_ERROR");
      }
    };

    initSensors();

    return () => {
      isCancelled = true;
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [selectedDeviceId, uploadedFile]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    if (!smallCanvasRef.current) {
      smallCanvasRef.current = document.createElement('canvas');
      smallCtxRef.current = smallCanvasRef.current.getContext('2d', { willReadFrequently: true });
    }
    const smallCanvas = smallCanvasRef.current;
    const smallCtx = smallCtxRef.current;

    const render = () => {
      const isVideoReady = video.readyState === video.HAVE_ENOUGH_DATA;
      const isImageReady = !!imageSource;

      if (isVideoReady || isImageReady) {
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
          canvas.width = displayWidth;
          canvas.height = displayHeight;
        }

        const fontSize = Math.max(5, Math.round(gridSize));
        const cols = Math.ceil(canvas.width / fontSize);
        const rows = Math.ceil(canvas.height / fontSize);
        const numCells = cols * rows;

        // Initialize or Resize Vertical Drops Buffer
        if (cascadingRain) {
          if (!dropsRef.current || dropsRef.current.length !== cols) {
              dropsRef.current = new Float32Array(cols);
              dropSpeedsRef.current = new Float32Array(cols);
              dropLengthsRef.current = new Float32Array(cols);
              for (let i = 0; i < cols; i++) {
                  dropsRef.current[i] = Math.random() * -rows; 
                  dropSpeedsRef.current[i] = 0.25 + Math.random() * 0.65;
                  dropLengthsRef.current[i] = 8 + Math.random() * 24;
              }
          }
          const drops = dropsRef.current;
          const speeds = dropSpeedsRef.current!;
          const lengths = dropLengthsRef.current!;

          // Vertical Stream Update (Only runs when cascading rain is on)
          for (let i = 0; i < cols; i++) {
              drops[i] += speeds[i]; 
              if (drops[i] > rows + lengths[i]) {
                  drops[i] = -lengths[i] - (Math.random() * 15); 
                  speeds[i] = 0.25 + Math.random() * 0.65;
                  lengths[i] = 8 + Math.random() * 24;
              }
          }
        }
        
        frameCountRef.current++;
        const frameTick = frameCountRef.current;

        if (smallCtx && cols > 0 && rows > 0) {
          smallCanvas.width = cols; 
          smallCanvas.height = rows;
          
          if (imageSource) {
            smallCtx.drawImage(imageSource, 0, 0, cols, rows);
          } else {
            // Fast aspect ratio calc
            const videoAspect = video.videoWidth / video.videoHeight;
            const canvasAspect = cols / rows; 
            
            let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;

            if (canvasAspect > videoAspect) {
               sh = sw / canvasAspect;
               sy = (video.videoHeight - sh) / 2;
            } else {
               sw = sh * canvasAspect;
               sx = (video.videoWidth - sw) / 2;
            }

            smallCtx.drawImage(video, sx, sy, sw, sh, 0, 0, cols, rows);
          }
          const pixels = smallCtx.getImageData(0, 0, cols, rows).data;

          if (!energyBufferRef.current || energyBufferRef.current.length !== numCells) {
            energyBufferRef.current = new Float32Array(numCells).fill(0);
            prevLumaBufferRef.current = new Float32Array(numCells).fill(0);
            currentLumaBufferRef.current = new Float32Array(numCells).fill(0);
          }
          
          const energyGrid = energyBufferRef.current;
          const prevLuma = prevLumaBufferRef.current!;
          const currentLuma = currentLumaBufferRef.current!;

          const baseDecay = 0.5 + (decayScale / 100) * 0.3; 
          const streamDecayFactor = 0.05 + (streamTrailDecayScale / 100) * 0.93; 
          const attack = 0.4; 

          const bayerMatrix = [
            [ 0/16,  8/16,  2/16, 10/16],
            [12/16,  4/16, 14/16,  6/16],
            [ 3/16, 11/16,  1/16,  9/16],
            [15/16,  7/16, 13/16,  5/16]
          ];

          let totalLuma = 0;

          // --- PASS 1: Physics & Energy (Optimized) ---
          for (let i = 0; i < numCells; i++) {
            const ix = i << 2;
            // Rec.709 luma coeff for better perceptual mapping
            const luma = (pixels[ix] * 0.2126 + pixels[ix + 1] * 0.7152 + pixels[ix + 2] * 0.0722) / 255;
            totalLuma += luma;
            currentLuma[i] = luma;
            
            const delta = Math.abs(luma - prevLuma[i]);
            prevLuma[i] = luma;

            let target = 0.0;
            // Simplified threshold logic
            if (luma > 0.6 || delta > 0.1) target = 1.0;
            
            if (target > energyGrid[i]) {
                energyGrid[i] += (target - energyGrid[i]) * attack;
            } else {
                energyGrid[i] *= (energyGrid[i] > 0.3 ? streamDecayFactor : baseDecay);
            }
          }
          
          const avgLuma = totalLuma / numCells;
          // Fixed gamma correction (Auto-exposure disabled)
          const fixedGamma = 1.8;

          // --- PASS 2: Rendering ---
          ctx.fillStyle = '#000800'; 
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.font = `bold ${fontSize}px 'Fira Code', monospace`;
          ctx.textBaseline = 'top';

          // Static modulator for solarization (Auto-exposure disabled)
          const brightModulator = 0.5; // Fixed compression for highlights
          const gridPulse = 0;

          for (let i = 0; i < numCells; i++) {
            const ix = i << 2;
            const r = pixels[ix];
            const g = pixels[ix+1];
            const b = pixels[ix+2];
            
            // Rec.709
            let lumaNorm = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
            
            // Apply fixed gamma
            lumaNorm = Math.pow(lumaNorm, fixedGamma);

            // --- Structural Mapping (Shadow Lifting) ---
            // Replaced pow() with a quadratic ease-out: x * (2.5 - x)
            // This lifts the 0.1-0.4 range significantly ("seeing in the dark") 
            // while preserving the 1.0 range.
            let structure = lumaNorm * (1.8 - lumaNorm); // Lowered structure multiplier
            
            // --- Dynamic Solarization (Bright Light Compression) ---
            // If light is very bright, we "invert" or dim it dynamically to show sensor overload
            // Compressed highlights threshold
            if (lumaNorm > 0.6) {
                // As luma goes 0.6 -> 1.0, we mix in the modulator
                // This makes bright lights pulse or turn dark green
                structure = structure * brightModulator;
            }

            const cx = i % cols;
            const cy = (i / cols) | 0;

            // Fast Edge Check (Laplacian 4-neighbor approximation)
            let edge = 0;
            if (cx > 0 && cx < cols - 1 && cy > 0 && cy < rows - 1) {
               const pLeft = currentLuma[i - 1];
               const pRight = currentLuma[i + 1];
               const pUp = currentLuma[i - cols];
               const pDown = currentLuma[i + cols];
               // Laplacian operator
               edge = Math.abs(4 * currentLuma[i] - pLeft - pRight - pUp - pDown);
            }

            const energy = energyGrid[i];
            const bayerThreshold = bayerMatrix[cy % 4][cx % 4];

            if (cascadingRain) {
              // --- CASCADING RAIN SCANNER MODE ---
              // Static binary is REMOVED.
              // ONLY the cascading falling binary is visible and reveals what is coming through the camera.
              const drops = dropsRef.current!;
              const lengths = dropLengthsRef.current!;
              const dropY = drops[cx];
              const dropLen = lengths[cx];
              const dist = dropY - cy;
              const isRain = dist > 0 && dist < dropLen;
              const isRainHead = dist > 0 && dist < 1.15;

              // Outside of the falling drops, the canvas is completely dark/void (no static binary)
              if (!isRain) {
                continue;
              }

              const trailFactor = Math.max(0, 1.0 - (dist / dropLen));
              const hasSubject = structure > 0.04 || edge > 0.07 || lumaNorm > 0.03;

              if (hasSubject) {
                // Reveal camera content dynamically within the rain stream
                let char = "0";
                if (isRainHead) {
                  char = "1";
                } else if (lumaNorm > bayerThreshold || edge > 0.12) {
                  char = "1";
                } else {
                  char = "0";
                }

                if (showColor) {
                  const brightMult = isRainHead ? 1.5 : (trailFactor * (0.6 + structure * 0.9));
                  const fr = Math.min(255, (r * brightMult) | 0);
                  const fg = Math.min(255, (g * brightMult) | 0);
                  const fb = Math.min(255, (b * brightMult) | 0);
                  ctx.fillStyle = isRainHead ? 'rgb(240, 255, 240)' : `rgb(${fr},${fg},${fb})`;
                } else {
                  if (isRainHead) {
                    ctx.fillStyle = 'rgb(230, 255, 230)';
                  } else {
                    let totalG = trailFactor * (25 + structure * 230 + (edge > 0.1 ? 80 : 0) + (energy * 80));
                    let totalRB = structure > 0.6 ? 40 : 0;
                    totalG = Math.min(255, Math.max(0, totalG | 0));
                    ctx.fillStyle = `rgb(${totalRB},${totalG},${totalRB})`;
                  }
                }

                ctx.fillText(char, cx * fontSize, cy * fontSize);
              } else {
                // Empty darkness in camera - subtle rain head trace so the waterfall sweep is visible
                if (isRainHead) {
                  ctx.fillStyle = 'rgba(0, 70, 0, 0.4)';
                  ctx.fillText("0", cx * fontSize, cy * fontSize);
                }
              }
            } else {
              // --- DEFAULT: FULL STATIC BINARY MATRIX FIELD ---
              let char = " ";
              
              if (energy > 0.5) {
                char = lumaNorm > bayerThreshold ? "1" : "0";
              } else if (edge > 0.15) {
                char = "1";
              } else {
                if (structure > 0.6) {
                  char = "1";
                } else if (structure > 0.25) {
                  char = structure > bayerThreshold * 0.8 + 0.1 ? "1" : "0";
                } else if (structure > 0.08) {
                  char = structure > bayerThreshold * 1.5 ? "0" : " ";
                } else {
                  char = " ";
                }
              }

              if (showColor) {
                const saturation = 0.4 + (energy * 0.6); 
                const lumaByte = lumaNorm * 255;
                let arR = r * saturation + lumaByte * (1 - saturation);
                let arG = g * saturation + lumaByte * (1 - saturation);
                let arB = b * saturation + lumaByte * (1 - saturation);
                const exposure = 0.8 + (energy * 0.5); 
                arR *= exposure; arG *= exposure; arB *= exposure;
                if (energy < 0.3) { arB += 15; arR -= 5; }
                const fr = (arR > 255 ? 255 : (arR < 0 ? 0 : arR)) | 0;
                const fg = (arG > 255 ? 255 : (arG < 0 ? 0 : arG)) | 0;
                const fb = (arB > 255 ? 255 : (arB < 0 ? 0 : arB)) | 0;
                ctx.fillStyle = `rgb(${fr},${fg},${fb})`;
              } else {
                let val = 24 + (structure * 180);
                if (edge > 0.1) {
                  val += edge * 150 * (0.5 + structure);
                }
                const digitalGreen = energy * 220;
                let totalG = val + digitalGreen + gridPulse;
                let totalRB = 0;
                if (energy > 0.75) {
                  totalRB += (energy - 0.75) * 600;
                  totalG += 60;
                }
                totalG = (totalG > 255 ? 255 : totalG) | 0;
                totalRB = (totalRB > 255 ? 255 : totalRB) | 0;
                ctx.fillStyle = `rgb(${totalRB},${totalG},${totalRB})`;
              }

              ctx.fillText(char, cx * fontSize, cy * fontSize);
            }
          }
        }

        // Telemetry calculation
        framesSampleRef.current++;
        if (framesSampleRef.current >= 30) {
          const now = performance.now();
          const elapsed = (now - lastFpsTimeRef.current) / 1000;
          if (elapsed > 0) {
            const calculatedFps = Math.round(framesSampleRef.current / elapsed);
            lastFpsTimeRef.current = now;
            framesSampleRef.current = 0;
            onTelemetryUpdate?.({
              fps: Math.min(Math.max(calculatedFps, 1), 120),
              resolution: `${canvas.width}x${canvas.height}`,
              cells: cols * rows
            });
          }
        }
      }
      animationRef.current = requestAnimationFrame(render);
    };
    
    render();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [gridSize, sensitivity, decayScale, streamTrailDecayScale, showColor, imageSource, onTelemetryUpdate]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        onFileDrop?.(file);
      }
    }
  };

  return (
    <div 
      className="relative w-full h-full bg-black overflow-hidden select-none"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="block w-full h-full cursor-none object-cover" />
      
      {/* Drag & Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/85 border-2 border-dashed border-green-500/80 backdrop-blur-sm pointer-events-none animate-pulse">
          <UploadCloud className="w-16 h-16 text-green-400 mb-3" />
          <span className="text-green-300 font-bold tracking-widest text-sm uppercase">DROP MEDIA FOR BINARY INGESTION</span>
          <span className="text-green-600 text-xs mt-1 font-mono">Accepts JPG, PNG, MP4, WEBM</span>
        </div>
      )}

      {cameraError && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/98 p-10 text-center backdrop-blur-sm">
          <AlertTriangle className="w-12 h-12 text-green-900 mb-6" />
          <h2 className="text-green-500 font-bold uppercase tracking-[0.4em] text-sm mb-4">SENSOR_DISCONNECT</h2>
          <div className="w-32 h-[1px] bg-green-900/50 mb-4" />
          <p className="text-green-900 text-[10px] uppercase tracking-tighter leading-relaxed max-w-xs">
            Visual link failed. Please verify hardware permissions and cycle power.
          </p>
        </div>
      )}
    </div>
  );
});

export default RealityMapper;
