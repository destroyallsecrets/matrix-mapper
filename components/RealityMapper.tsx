import React, { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';

interface RealityMapperProps {
  isScanning: boolean;
  mode: string;
  showColor: boolean;
  gridSize: number;
  enableZoom: boolean;
  sensitivity: number;   // 0-100: How hard the signal hits
  refraction: number;    // 0-100: Signal amplification / Noise floor
  range: number;         // 0-100: Simulation speed/Pulse frequency
  decayScale: number;    // 0-100: Length of the matrix trail & Decay rate
  onExternalStateChange?: (isActive: boolean) => void;
}

export interface RealityMapperHandle {
  getSnapshot: () => string | null;
  toggleExternalWindow: () => void;
}

const RealityMapper = forwardRef<RealityMapperHandle, RealityMapperProps>(({ 
  isScanning, 
  mode, 
  showColor, 
  gridSize, 
  enableZoom,
  sensitivity,
  refraction,
  range,
  decayScale,
  onExternalStateChange 
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  
  // Physics State
  // We use a persistent buffer for "Grid Energy" to simulate light refraction/decay
  const gridEnergyRef = useRef<Float32Array | null>(null);
  const dropsRef = useRef<number[]>([]);
  
  // Zoom & Pan State
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const lastTouchDistRef = useRef<number>(0);
  
  // External Window State
  const [externalActive, setExternalActive] = useState(false);
  const externalWindowRef = useRef<Window | null>(null);
  
  // Character Sets
  const CHARS_HIGH = "1";
  const CHARS_MED = "10";
  const CHARS_LOW = "0";

  // --- External Window & Lifecycle ---
  const toggleExternalWindow = () => {
    if (externalActive) {
      externalWindowRef.current?.close();
      setExternalActive(false);
      onExternalStateChange?.(false);
      externalWindowRef.current = null;
    } else {
      if (!canvasRef.current) return;
      const width = 800;
      const height = 600;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      const newWindow = window.open('', 'MatrixFeed', `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`);

      if (newWindow) {
        externalWindowRef.current = newWindow;
        newWindow.document.title = "MATRIX // SIGNAL_OUTPUT";
        newWindow.document.body.style.margin = '0';
        newWindow.document.body.style.backgroundColor = '#000';
        newWindow.document.body.style.overflow = 'hidden';
        newWindow.document.body.style.display = 'flex';
        newWindow.document.body.style.justifyContent = 'center';
        newWindow.document.body.style.alignItems = 'center';
        const video = newWindow.document.createElement('video');
        video.autoplay = true;
        video.muted = true;
        video.style.width = '100vw';
        video.style.height = '100vh';
        video.style.objectFit = 'contain';
        newWindow.document.body.appendChild(video);

        // @ts-ignore
        if (canvasRef.current.captureStream) {
            // @ts-ignore
            const stream = canvasRef.current.captureStream(30);
            video.srcObject = stream;
        }

        newWindow.addEventListener('beforeunload', () => {
          setExternalActive(false);
          onExternalStateChange?.(false);
          externalWindowRef.current = null;
        });

        setExternalActive(true);
        onExternalStateChange?.(true);
      }
    }
  };

  useImperativeHandle(ref, () => ({
    getSnapshot: () => {
      if (!videoRef.current) return null;
      const snapshotCanvas = document.createElement('canvas');
      snapshotCanvas.width = videoRef.current.videoWidth;
      snapshotCanvas.height = videoRef.current.videoHeight;
      const ctx = snapshotCanvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(videoRef.current, 0, 0);
      return snapshotCanvas.toDataURL('image/jpeg', 0.8);
    },
    toggleExternalWindow: () => toggleExternalWindow()
  }), [externalActive]);

  // Reset zoom when disabled
  useEffect(() => {
    if (!enableZoom) {
      transformRef.current = { x: 0, y: 0, scale: 1 };
    }
  }, [enableZoom]);

  // --- Interaction Handlers (Zoom/Pan) ---
  const handleWheel = (e: React.WheelEvent) => {
    if (!enableZoom) return;
    e.preventDefault();
    const intensity = 0.001;
    const { x, y, scale } = transformRef.current;
    let newScale = scale - e.deltaY * intensity * scale;
    newScale = Math.min(Math.max(1, newScale), 5);
    if (newScale === scale) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const ratio = newScale / scale;
    let newX = mouseX - (mouseX - x) * ratio;
    let newY = mouseY - (mouseY - y) * ratio;

    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    const minX = canvasWidth - canvasWidth * newScale;
    const minY = canvasHeight - canvasHeight * newScale;
    
    newX = Math.min(0, Math.max(minX, newX));
    newY = Math.min(0, Math.max(minY, newY));

    transformRef.current = { x: newX, y: newY, scale: newScale };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!enableZoom) return;
    isDraggingRef.current = true;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!enableZoom || !isDraggingRef.current) return;
    e.preventDefault();
    const dx = e.clientX - lastPosRef.current.x;
    const dy = e.clientY - lastPosRef.current.y;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    const { x, y, scale } = transformRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    let newX = x + dx;
    let newY = y + dy;
    const minX = rect.width - rect.width * scale;
    const minY = rect.height - rect.height * scale;
    newX = Math.min(0, Math.max(minX, newX));
    newY = Math.min(0, Math.max(minY, newY));
    transformRef.current = { x: newX, y: newY, scale };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!enableZoom) return;
    if (e.touches.length === 1) {
        isDraggingRef.current = true;
        lastPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
        isDraggingRef.current = false;
        const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        lastTouchDistRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!enableZoom) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (e.touches.length === 1 && isDraggingRef.current) {
        const dx = e.touches[0].clientX - lastPosRef.current.x;
        const dy = e.touches[0].clientY - lastPosRef.current.y;
        lastPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        const { x, y, scale } = transformRef.current;
        let newX = x + dx;
        let newY = y + dy;
        const minX = rect.width - rect.width * scale;
        const minY = rect.height - rect.height * scale;
        newX = Math.min(0, Math.max(minX, newX));
        newY = Math.min(0, Math.max(minY, newY));
        transformRef.current = { x: newX, y: newY, scale };
    }
    
    if (e.touches.length === 2) {
        const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        
        if (lastTouchDistRef.current > 0) {
            const delta = dist - lastTouchDistRef.current;
            const { x, y, scale } = transformRef.current;
            const zoomSpeed = 0.005;
            let newScale = scale + delta * zoomSpeed * scale;
            newScale = Math.min(Math.max(1, newScale), 5);
            const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
            const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
            const ratio = newScale / scale;
            let newX = centerX - (centerX - x) * ratio;
            let newY = centerY - (centerY - y) * ratio;
            const minX = rect.width - rect.width * newScale;
            const minY = rect.height - rect.height * newScale;
            newX = Math.min(0, Math.max(minX, newX));
            newY = Math.min(0, Math.max(minY, newY));
            transformRef.current = { x: newX, y: newY, scale: newScale };
        }
        lastTouchDistRef.current = dist;
    }
  };

  useEffect(() => {
    return () => {
      if (externalWindowRef.current) externalWindowRef.current.close();
    };
  }, []);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
        if (containerRef.current && canvasRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            canvasRef.current.width = rect.width;
            canvasRef.current.height = rect.height;
            // Clear Physics buffers on resize to avoid alignment errors
            gridEnergyRef.current = null; 
            dropsRef.current = [];
            transformRef.current = { x: 0, y: 0, scale: 1 };
        }
    };
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    handleResize();
    return () => observer.disconnect();
  }, []);

  // Webcam Logic
  useEffect(() => {
    let stream: MediaStream | null = null;
    let mounted = true;

    const startWebcam = async () => {
      try {
        if (videoRef.current && videoRef.current.srcObject) {
            const oldStream = videoRef.current.srcObject as MediaStream;
            oldStream.getTracks().forEach(track => track.stop());
        }
        const newStream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 1280, height: 720, facingMode: "user" } 
        });
        if (!mounted) {
            newStream.getTracks().forEach(track => track.stop());
            return;
        }
        stream = newStream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(e => console.error("Video play error:", e));
        }
      } catch (err) {
        if (mounted) console.error("Error accessing webcam:", err);
      }
    };
    startWebcam();
    return () => {
      mounted = false;
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  // Main Physics & Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const fontSize = Math.max(4, Math.round(gridSize));
    let frameCount = 0;

    const render = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const width = canvas.width;
        const height = canvas.height;
        if (width === 0 || height === 0) return;

        const columns = Math.ceil(width / fontSize);
        const rows = Math.ceil(height / fontSize);
        const numCells = columns * rows;

        // --- 1. Downsample Video ---
        const smallCanvas = document.createElement('canvas');
        smallCanvas.width = columns;
        smallCanvas.height = rows;
        const smallCtx = smallCanvas.getContext('2d');
        
        if (smallCtx) {
           smallCtx.translate(columns, 0);
           smallCtx.scale(-1, 1);
           smallCtx.drawImage(video, 0, 0, columns, rows);
           const imageData = smallCtx.getImageData(0, 0, columns, rows);
           const pixels = imageData.data;

           // --- 2. Initialize or Resize Physics Buffers ---
           if (!gridEnergyRef.current || gridEnergyRef.current.length !== numCells) {
               gridEnergyRef.current = new Float32Array(numCells).fill(0);
               dropsRef.current = Array(columns).fill(0).map(() => Math.random() * -100);
           }
           
           const energyGrid = gridEnergyRef.current;

           // --- 3. Physics Simulation (Pulse vs Decay) ---
           // Calculate settings derived values
           const sensMult = (sensitivity / 50); // 0.0 - 2.0
           
           // Map decayScale (0-100) to length (10 - 200 chars)
           const streamLen = Math.max(10, Math.floor(decayScale * 2));
           
           // DECAY CALCULATION:
           // Link the grid energy decay directly to the stream length (decayScale).
           // We want the energy to fade to 0.05 (visible threshold) over the course of 'streamLen' frames
           // to match the visual trail of the matrix rain.
           // Formula: 0.05 = factor ^ streamLen  =>  factor = 0.05 ^ (1/streamLen)
           const decayFactor = Math.pow(0.05, 1 / streamLen);
           
           // Refraction now acts as a noise floor / amplifier modifier
           // Higher refraction = slightly more noise/signal boost
           const noiseChance = 0.0002 + (refraction / 100) * 0.0008;

           // Process Grid
           for (let i = 0; i < numCells; i++) {
               const r = pixels[i * 4];
               const g = pixels[i * 4 + 1];
               const b = pixels[i * 4 + 2];
               
               // Calculate input brightness (The "Pulse")
               const brightness = (r + g + b) / 3 / 255.0; 
               
               // Add new energy based on sensitivity with a small noise gate
               const noiseGate = 0.05;
               let inputEnergy = Math.max(0, brightness - noiseGate) * sensMult;

               // Inject random noise for "Idle" activity that decays naturally
               // This creates a slow-fading static effect rather than flickering
               if (Math.random() < noiseChance) {
                   inputEnergy = Math.max(inputEnergy, Math.random() * 0.5 + 0.2); 
               }

               // Apply Decay (The "Refraction/Idle")
               // current = current * decay
               // We take the max of decay or new input to allow bright signals to override decay
               energyGrid[i] = Math.max(energyGrid[i] * decayFactor, inputEnergy);
               
               // Cap at 1.0
               if (energyGrid[i] > 1.0) energyGrid[i] = 1.0;
           }

           // --- 4. Matrix Drop Logic (Modified by Range) ---
           const speedMult = 0.5 + (range / 50); // Speed modifier
           
           for (let i = 0; i < dropsRef.current.length; i++) {
               // Drops fall faster if the column has high total energy
               // Sample middle pixel of column for rough estimate
               const midIdx = Math.floor(rows/2) * columns + i;
               const colEnergy = energyGrid[midIdx];
               
               // Slower base speed for subtler flow
               const dropSpeed = (0.2 + colEnergy * 1.5) * speedMult;
               dropsRef.current[i] += dropSpeed;
               
               if (dropsRef.current[i] > rows + 40) {
                   dropsRef.current[i] = -Math.random() * 40; // Reset higher up
               }
           }

           // --- 5. Rendering ---
           ctx.setTransform(1, 0, 0, 1, 0, 0);
           ctx.fillStyle = '#000000';
           ctx.fillRect(0, 0, width, height);
           
           // Apply Zoom
           const { x, y, scale } = transformRef.current;
           ctx.setTransform(scale, 0, 0, scale, x, y);

           ctx.font = `${fontSize}px 'Fira Code', monospace`;
           ctx.textBaseline = 'top';

           for (let cy = 0; cy < rows; cy++) {
             const rowOffset = cy * columns;
             for (let cx = 0; cx < columns; cx++) {
               const idx = rowOffset + cx;
               const energy = energyGrid[idx];

               // --- Matrix Stream (Rain) Calculations ---
               const dropHead = dropsRef.current[cx];
               const dist = dropHead - cy;
               
               let isHead = false;
               let streamOpacity = 0;

               if (dist >= 0 && dist < 1) {
                   isHead = true;
               } else if (dist > 0 && dist < streamLen) {
                   // Linear falloff for slow decay
                   // Start at 0.95 opacity to ensure "1s" (High Energy chars) appear in the tail
                   streamOpacity = (1 - (dist / streamLen)) * 0.95; 
               }

               // --- Optimization: Skip empty space ---
               // Only skip if both energy (reality) and stream (rain) are dark
               if (energy < 0.05 && streamOpacity < 0.05) {
                   continue;
               }

               // --- Character Selection ---
               // High energy or Stream Head gets active characters
               let char = '';
               const effectiveEnergy = Math.max(energy, streamOpacity);
               
               if (effectiveEnergy > 0.8) {
                   const charIdx = (cx + cy + frameCount) % CHARS_HIGH.length;
                   char = CHARS_HIGH[charIdx];
               } else if (effectiveEnergy > 0.4) {
                   const charIdx = (cx * cy) % CHARS_MED.length;
                   char = CHARS_MED[charIdx];
               } else {
                   char = CHARS_LOW[cx % CHARS_LOW.length];
               }

               // --- Color / Style ---
               let fillStyle = '';

               if (isHead) {
                   fillStyle = '#ffffff'; // The leader is always white
               } else if (showColor) {
                  // RGB Mode: Blend reality map with stream opacity
                  const r = pixels[idx * 4];
                  const g = pixels[idx * 4 + 1];
                  const b = pixels[idx * 4 + 2];
                  // Boost brightness by stream opacity
                  const boost = streamOpacity * 255;
                  fillStyle = `rgba(${Math.min(255, r+boost)},${Math.min(255, g+boost)},${Math.min(255, b+boost)},${effectiveEnergy})`;
               } else {
                  // Matrix Mode
                  if (effectiveEnergy > 0.9) {
                      fillStyle = '#ccffcc';
                  } else if (effectiveEnergy > 0.6) {
                      fillStyle = `rgba(100, 255, 100, ${effectiveEnergy})`;
                  } else {
                      // Fading trail / Decay map
                      const val = Math.floor(effectiveEnergy * 180);
                      fillStyle = `rgb(0, ${val}, 0)`;
                  }
               }
               
               ctx.fillStyle = fillStyle;
               ctx.fillText(char, cx * fontSize, cy * fontSize);
             }
           }
        }
      }
      
      frameCount++;
      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isScanning, showColor, gridSize, sensitivity, refraction, range, decayScale]); 

  return (
    <div 
      ref={containerRef} 
      className={`relative w-full h-full border border-green-900 bg-black rounded-lg overflow-hidden shadow-[0_0_15px_rgba(0,255,0,0.2)] ${enableZoom ? 'cursor-grab active:cursor-grabbing touch-none' : ''}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
    >
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas 
        ref={canvasRef} 
        className="block bg-black"
        style={{ width: '100%', height: '100%' }}
      />

      {externalActive && (
        <div className="absolute top-4 left-4 z-30 flex items-center gap-2 pointer-events-none animate-in fade-in slide-in-from-top-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-[pulse_1s_ease-in-out_infinite] shadow-[0_0_8px_#f00]" />
            <span className="text-[10px] font-bold text-red-500 tracking-widest bg-black/60 px-1.5 py-0.5 rounded border border-red-900/30 backdrop-blur-sm">
                REC / EXT_FEED
            </span>
        </div>
      )}
    </div>
  );
});

export default RealityMapper;