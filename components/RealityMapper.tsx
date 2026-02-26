import React, { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';

interface RealityMapperProps {
  selectedDeviceId?: string;
  onStreamActive?: () => void;
}

export interface RealityMapperHandle {
  getSnapshot: () => string | null;
}

const FONT_SIZE = 8;

const RealityMapper = forwardRef<RealityMapperHandle, RealityMapperProps>((props, ref) => {
  const { 
    selectedDeviceId,
    onStreamActive
  } = props;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const lumaBufferRef = useRef<Float32Array | null>(null);
  const prevLumaRef = useRef<Float32Array | null>(null);
  
  const smallCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const smallCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  
  const rainPhaseRef = useRef(0);
  const frameCountRef = useRef(0);

  // Scientific calibration state (behind-the-scenes, no visible effect by default)
  const calRef = useRef({
    darkLevel: 0.02,
    whiteLevel: 0.95,
    gain: 1.0,
    offset: 0.0,
    calibrated: false,
    calibrationFrames: 0,
    noiseFloor: 0.01,
    edgeThresholdLow: 0.1,
    edgeThresholdHigh: 0.2,
    exposureGain: 1.0,
    signalMean: 0.5,
    motionHistory: new Float32Array(0) as Float32Array
  });

  useImperativeHandle(ref, () => ({
    getSnapshot: () => {
      if (!canvasRef.current) return null;
      return canvasRef.current.toDataURL('image/png');
    }
  }));

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let isCancelled = false;

    const initSensors = async () => {
      setCameraError(null);
      try {
        let stream = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } 
          });
        } catch (e) {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: true 
          });
        }
        
        if (isCancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        activeStream = stream;
        
        if (videoRef.current) { 
          videoRef.current.srcObject = stream; 
          await videoRef.current.play();
          setCameraReady(true);
          onStreamActive?.();
        }
      } catch (err: any) {
        console.error('Camera error:', err);
        setCameraError(err.message || err.name || "Camera not available");
      }
    };

    initSensors();

    return () => {
      isCancelled = true;
      activeStream?.getTracks().forEach(t => t.stop());
    };
  }, [selectedDeviceId, cameraReady]);

  useEffect(() => {
    if (!cameraReady) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!smallCanvasRef.current) {
      smallCanvasRef.current = document.createElement('canvas');
      smallCtxRef.current = smallCanvasRef.current.getContext('2d', { willReadFrequently: true });
    }
    const smallCanvas = smallCanvasRef.current;
    const smallCtx = smallCtxRef.current;

    const render = () => {
      if (!video) return;
      
      const displayWidth = canvas.clientWidth || 800;
      const displayHeight = canvas.clientHeight || 600;
      
      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
      }

      const cols = Math.ceil(canvas.width / FONT_SIZE);
      const rows = Math.ceil(canvas.height / FONT_SIZE);
      const numCells = cols * rows;

      if (smallCtx && cols > 0 && rows > 0 && video.readyState >= 2) {
        smallCanvas.width = cols;
        smallCanvas.height = rows;
        
        const videoAspect = video.videoWidth / video.videoHeight;
        const canvasAspect = cols / rows;
        
        let sx = 0, sy = 0, sw = video.videoWidth || 640, sh = video.videoHeight || 480;

        if (canvasAspect > videoAspect) {
           sh = sw / canvasAspect;
           sy = (video.videoHeight - sh) / 2;
        } else {
           sw = sh * canvasAspect;
           sx = (video.videoWidth - sw) / 2;
        }

        smallCtx.drawImage(video, sx, sy, sw, sh, 0, 0, cols, rows);
        const pixels = smallCtx.getImageData(0, 0, cols, rows).data;

        if (!lumaBufferRef.current || lumaBufferRef.current.length !== numCells) {
          lumaBufferRef.current = new Float32Array(numCells);
          prevLumaRef.current = new Float32Array(numCells);
        }
        
        const luma = lumaBufferRef.current;
        const prevLuma = prevLumaRef.current;
        const cal = calRef.current;

        // Calculate luma (Rec. 709 coefficients - scientific standard)
        for (let i = 0; i < numCells; i++) {
          const ix = i << 2;
          // Precise Rec. 709 coefficients (behind-the-scenes)
          const raw = (pixels[ix] * 0.2126 + pixels[ix + 1] * 0.7152 + pixels[ix + 2] * 0.0722) / 255;
          
          // Scientific calibration (behind-the-scenes, no visible effect yet)
          let calibrated = (raw + cal.offset) * cal.gain;
          calibrated = Math.max(0, Math.min(1, calibrated));
          
          // Adaptive exposure (subtle, behind-the-scenes)
          calibrated = calibrated * cal.exposureGain;
          
          luma[i] = calibrated;
        }

        // Track scene statistics (behind-the-scenes)
        let sum = 0;
        let minL = 1, maxL = 0;
        for (let i = 0; i < numCells; i++) {
          sum += luma[i];
          if (luma[i] < minL) minL = luma[i];
          if (luma[i] > maxL) maxL = luma[i];
        }
        cal.signalMean = sum / numCells;
        
        // Auto exposure (behind-the-scenes, subtle)
        const targetMean = 0.45;
        const error = targetMean - cal.signalMean;
        cal.exposureGain += error * 0.01;
        cal.exposureGain = Math.max(0.7, Math.min(1.5, cal.exposureGain));

        // Initialize motion history
        if (cal.motionHistory.length !== numCells) {
          cal.motionHistory = new Float32Array(numCells);
        }

        // Calculate edges (Canny-style, behind-the-scenes)
        const edges = new Float32Array(numCells);
        for (let r = 1; r < rows - 1; r++) {
          for (let c = 1; c < cols - 1; c++) {
            const i = r * cols + c;
            const l = luma[i];
            const l_left = luma[i - 1];
            const l_right = luma[i + 1];
            const l_up = luma[i - cols];
            const l_down = luma[i + cols];
            edges[i] = Math.abs(4 * l - l_left - l_right - l_up - l_down);
          }
        }

        // Update animation phase
        frameCountRef.current++;
        rainPhaseRef.current += 0.05;

        // Clear canvas
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = `bold ${FONT_SIZE}px 'Fira Code', monospace`;
        ctx.textBaseline = 'top';

        // Render FULL grid
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const i = row * cols + col;
            const l = luma[i];
            const edge = edges[i];
            const motion = prevLuma[i] ? Math.abs(luma[i] - prevLuma[i]) : 0;
            
            // Motion tracking (behind-the-scenes)
            cal.motionHistory[i] = cal.motionHistory[i] * 0.7 + motion * 0.3;
            
            // Show character based on luminance (same threshold as before)
            const showChar = l > 0.08;
            
            if (showChar) {
              let brightness = l;
              
              // Edge enhancement (same as before)
              if (edge > 0.1) {
                brightness = Math.min(1, brightness + edge * 1.5);
              }
              
              // Motion highlight (same as before)
              if (motion > 0.05) {
                brightness = Math.min(1, brightness + motion * 2);
              }
              
              // Rain shimmer (same as before)
              const shimmer = Math.sin(col * 0.3 + rainPhaseRef.current) * 0.1 + 0.9;
              brightness *= shimmer;
              
              // Character alternation (same as before)
              const char = ((row + col + Math.floor(rainPhaseRef.current * 2)) % 2 === 0) ? '1' : '0';
              
              // Color mapping (same as before)
              let r, g, b;
              
              if (brightness > 0.8) {
                const white = (brightness - 0.8) * 5;
                r = Math.floor(200 * white);
                g = 255;
                b = Math.floor(200 * white);
              } else if (brightness > 0.5) {
                const green = (brightness - 0.5) * 2 * 255;
                r = Math.floor(green * 0.25);
                g = Math.floor(green);
                b = Math.floor(green * 0.25);
              } else if (brightness > 0.25) {
                const green = brightness * 255;
                r = Math.floor(green * 0.15);
                g = Math.floor(green * 0.85);
                b = Math.floor(green * 0.15);
              } else {
                const green = brightness * 180;
                r = Math.floor(green * 0.1);
                g = Math.floor(green);
                b = Math.floor(green * 0.1);
              }
              
              ctx.fillStyle = `rgb(${r},${g},${b})`;
              ctx.fillText(char, col * FONT_SIZE, row * FONT_SIZE);
            }
          }
        }
        
        // Store for next frame
        for (let i = 0; i < numCells; i++) {
          prevLuma[i] = luma[i];
        }
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width || 800, canvas.height || 600);
      }
      animationRef.current = requestAnimationFrame(render);
    };
    
    render();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [selectedDeviceId, cameraReady]);

  return (
    <div className="relative w-full h-full min-h-[400px] bg-black overflow-hidden select-none">
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="block w-full h-full" style={{ minHeight: '400px', cursor: 'default' }} />
      {!cameraReady && !cameraError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-green-600 text-lg">Starting camera...</span>
        </div>
      )}
      {cameraError && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black p-10 text-center">
          <h2 className="text-red-500 font-bold text-2xl mb-4">CAMERA ERROR</h2>
          <p className="text-red-400 text-lg mb-2">{cameraError}</p>
          <p className="text-green-600 text-sm mt-4">Allow camera permission and refresh</p>
        </div>
      )}
    </div>
  );
});

export default RealityMapper;
