
import React, { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

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
}

export interface RealityMapperHandle {
  getSnapshot: () => string | null;
  togglePiP: () => Promise<void>;
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
    onStreamActive
  } = props;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // PiP Video Reference
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);

  // Performance-optimized buffers
  const energyBufferRef = useRef<Float32Array | null>(null);
  const prevLumaBufferRef = useRef<Float32Array | null>(null);
  const currentLumaBufferRef = useRef<Float32Array | null>(null);
  const dropsRef = useRef<Float32Array | null>(null); 
  
  // Video processing pipeline
  const smallCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const smallCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  
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
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          const canvas = canvasRef.current;
          if (!canvas) return;

          if (!pipVideoRef.current) {
            pipVideoRef.current = document.createElement('video');
            pipVideoRef.current.muted = true;
            pipVideoRef.current.playsInline = true;
          }
          
          const pipVideo = pipVideoRef.current;
          // @ts-ignore
          if (canvas.captureStream && (pipVideo.srcObject === null || pipVideo.srcObject === undefined)) {
             // @ts-ignore
             const stream = canvas.captureStream(30);
             pipVideo.srcObject = stream;
             await pipVideo.play();
          }
          
          if (pipVideo.readyState >= 1) { 
             await pipVideo.requestPictureInPicture();
          } else {
             pipVideo.onloadedmetadata = async () => {
               await pipVideo.requestPictureInPicture();
             }
          }
        }
      } catch (err) {
        console.error("PiP Error:", err);
      }
    }
  }));

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let isCancelled = false;

    const initSensors = async () => {
      setCameraError(null);
      try {
        const vConstraints = { 
          video: { 
            deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
            width: { ideal: 1280 }, 
            height: { ideal: 720 },
            facingMode: selectedDeviceId ? undefined : { ideal: "environment" }
          } 
        };
        const stream = await navigator.mediaDevices.getUserMedia(vConstraints);
        if (isCancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        activeStream = stream;
        if (videoRef.current) { 
          videoRef.current.srcObject = stream; 
          videoRef.current.play().catch(() => {}); 
          onStreamActive?.();
        }
      } catch (err: any) {
        if (!isCancelled) setCameraError(err.name === 'NotAllowedError' ? "ACCESS DENIED" : "SENSOR_ERROR");
      }
    };

    initSensors();

    return () => {
      isCancelled = true;
      activeStream?.getTracks().forEach(t => t.stop());
    };
  }, [selectedDeviceId]);

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
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
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
        if (!dropsRef.current || dropsRef.current.length !== cols) {
            dropsRef.current = new Float32Array(cols);
            for (let i = 0; i < cols; i++) {
                dropsRef.current[i] = Math.random() * -rows; 
            }
        }
        const drops = dropsRef.current;
        frameCountRef.current++;
        const frameTick = frameCountRef.current;

        // Vertical Stream Update
        for (let i = 0; i < cols; i++) {
            drops[i] += 0.4; 
            if (drops[i] > rows) {
                drops[i] = -20 - (Math.random() * 50); 
            }
        }

        if (smallCtx && cols > 0 && rows > 0) {
          smallCanvas.width = cols; 
          smallCanvas.height = rows;
          
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
          // Adaptive gamma correction based on average luma
          // Lowered gamma significantly to make the image darker and more contrasted
          const adaptiveGamma = avgLuma < 0.3 ? 2.2 : (avgLuma > 0.7 ? 1.5 : 1.8);

          // --- PASS 2: Rendering ---
          ctx.fillStyle = '#000800'; 
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.font = `bold ${fontSize}px 'Fira Code', monospace`;
          ctx.textBaseline = 'top';

          // Pre-calculate
          const gridPulse = 0;
          // Sine wave for solarization (dynamic brights)
          // Peaks at 1.0, dips to -0.2
          const solarPulse = Math.sin(frameTick * 0.1); 
          const brightModulator = 0.4 + (solarPulse * 0.3); // fluctuates 0.1 to 0.7 - compressed highlights

          for (let i = 0; i < numCells; i++) {
            const ix = i << 2;
            const r = pixels[ix];
            const g = pixels[ix+1];
            const b = pixels[ix+2];
            
            // Rec.709
            let lumaNorm = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
            
            // Apply adaptive gamma
            lumaNorm = Math.pow(lumaNorm, adaptiveGamma);

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
            const dropY = drops[cx];
            const dist = dropY - cy;
            const isRain = dist > 0 && dist < 15;
            const isRainHead = dist > 0 && dist < 2;

            // --- Binary Optimization: Enhanced Dithering & Edge Mapping ---
            const bayerThreshold = bayerMatrix[cy % 4][cx % 4];
            
            let char = " ";
            if (energy > 0.5) {
                char = lumaNorm > bayerThreshold ? "1" : "0";
            } else if (isRain) {
                char = ((i + frameTick) & 4) ? "1" : "0"; // pattern based
            } else if (edge > 0.15) {
                // Edges are always represented to preserve shapes
                char = "1";
            } else {
                // Better light to binary conversion
                if (structure > 0.6) {
                    char = "1"; // Solid highlights
                } else if (structure > 0.25) {
                    // Dithered midtones
                    char = structure > bayerThreshold * 0.8 + 0.1 ? "1" : "0";
                } else if (structure > 0.08) {
                    // Sparse darks
                    char = structure > bayerThreshold * 1.5 ? "0" : " ";
                } else {
                    char = " "; // True darkness
                }
            }

            if (showColor) {
              // Natural Mode logic
              const saturation = 0.4 + (energy * 0.6); 
              const lumaByte = lumaNorm * 255;
              
              let arR = r * saturation + lumaByte * (1 - saturation);
              let arG = g * saturation + lumaByte * (1 - saturation);
              let arB = b * saturation + lumaByte * (1 - saturation);

              const exposure = 0.8 + (energy * 0.5); 
              arR *= exposure; arG *= exposure; arB *= exposure;

              if (energy < 0.3) { arB += 15; arR -= 5; }
              
              // Integer clamp
              const fr = (arR > 255 ? 255 : (arR < 0 ? 0 : arR)) | 0;
              const fg = (arG > 255 ? 255 : (arG < 0 ? 0 : arG)) | 0;
              const fb = (arB > 255 ? 255 : (arB < 0 ? 0 : arB)) | 0;

              ctx.fillStyle = `rgb(${fr},${fg},${fb})`;

            } else {
              // Terminal Mode (Optimized)

              // Base Ambient: 24 (visible darks)
              // Structure Gain: 180 (contrast)
              let val = 24 + (structure * 180);
              
              // Add edge glow modulated by structure
              if (edge > 0.1) {
                  val += edge * 150 * (0.5 + structure);
              }

              const digitalGreen = energy * 220;
              let rainGreen = 0;
              let rainHighlight = 0;

              if (isRain) {
                  const rainIntensity = isRainHead ? 1.0 : 0.4;
                  rainGreen = (rainIntensity * 30) + (rainIntensity * structure * 180);
                  if (isRainHead && structure > 0.3) {
                      rainHighlight = 120 * structure;
                  }
              }
              
              let totalG = val + digitalGreen + gridPulse + rainGreen;
              let totalRB = rainHighlight;

              if (energy > 0.75) {
                  // Thermal bloom
                  totalRB += (energy - 0.75) * 600; // Stronger kick
                  totalG += 60; 
              }

              // Fast Clamping
              totalG = (totalG > 255 ? 255 : totalG) | 0;
              totalRB = (totalRB > 255 ? 255 : totalRB) | 0;

              // String concats are inevitable but fast enough here
              ctx.fillStyle = `rgb(${totalRB},${totalG},${totalRB})`;
            }

            ctx.fillText(char, cx * fontSize, cy * fontSize);
          }
        }
      }
      animationRef.current = requestAnimationFrame(render);
    };
    
    render();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [gridSize, sensitivity, decayScale, streamTrailDecayScale, showColor]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="block w-full h-full cursor-none object-cover" />
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
