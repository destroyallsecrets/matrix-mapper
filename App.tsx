import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import MatrixRain from './components/MatrixRain';
import RealityMapper, { RealityMapperHandle } from './components/RealityMapper';
import TerminalOutput from './components/TerminalOutput';
import { analyzeSector } from './services/geminiService';
import { playTacticalSound } from './services/audioFx';
import { LogEntry, MapMode, TacticalTelemetry } from './types';
import { 
  Cpu, 
  Settings, 
  X, 
  Scan, 
  Cast, 
  Minimize2, 
  Terminal, 
  Layers, 
  Camera, 
  Activity, 
  ExternalLink, 
  Video, 
  Aperture, 
  Upload, 
  Maximize, 
  RefreshCw,
  Volume2,
  VolumeX,
  Tv,
  HelpCircle,
  FileVideo,
  FileImage,
  CloudRain
} from 'lucide-react';

const App: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [mode, setMode] = useState<MapMode>(MapMode.IDLE);
  const realityMapperRef = useRef<RealityMapperHandle>(null);
  
  // UI States
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBroadcastMode, setIsBroadcastMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Configuration options
  const [naturalColorMode, setNaturalColorMode] = useState(false);
  const [cascadingRain, setCascadingRain] = useState(false);
  const [showTerminal, setShowTerminal] = useState(window.innerWidth > 1024);
  const [mobileTerminalOpen, setMobileTerminalOpen] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [streamTrailDecay, setStreamTrailDecay] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [crtScanlines, setCrtScanlines] = useState(true);
  
  // Telemetry state
  const [telemetry, setTelemetry] = useState<{ fps: number; resolution: string; cells: number }>({
    fps: 60,
    resolution: 'INIT...',
    cells: 0
  });

  // Window size state for responsiveness
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Tactical simulation constants
  const sensitivity = 85; 
  const density = 85; 
  const decayScale = 12; // Zero-Ghosting tuning for the void
  
  const isMobile = windowWidth < 768;
  const baseGrid = isMobile ? 7 : 9;
  const currentGridSize = Math.max(isMobile ? 5 : 4, Math.round(32 - (density / 100) * (32 - baseGrid)));

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'system') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      message,
      type
    };
    setLogs(prev => [...prev.slice(-49), newLog]);
  }, []);

  // Update CRT overlay visibility in DOM
  useEffect(() => {
    const scanlineEl = document.getElementById('crt-scanlines');
    const flickerEl = document.getElementById('crt-flicker');
    if (scanlineEl) scanlineEl.style.display = crtScanlines ? 'block' : 'none';
    if (flickerEl) flickerEl.style.display = crtScanlines ? 'block' : 'none';
  }, [crtScanlines]);

  // Recording duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      setRecordingSeconds(0);
      interval = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(device => device.kind === 'videoinput');
      setVideoDevices(videoInputs);
      
      if (videoInputs.length > 0 && !selectedCamera) {
        const back = videoInputs.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'));
        setSelectedCamera(back?.deviceId || videoInputs[0].deviceId);
      }
    } catch (err) {
      console.error("Device probe failure:", err);
    }
  }, [selectedCamera]);

  const toggleBroadcastMode = () => {
    setIsBroadcastMode(prev => {
      const next = !prev;
      playTacticalSound('switch', soundEnabled);
      addLog(next ? "SIGHT_UPLINK: ENCRYPTED_BROADCAST" : "INTERFACE_REVERT: LOCAL_HUD", "system");
      return next;
    });
  };

  const handlePopout = async () => {
    if (realityMapperRef.current) {
      playTacticalSound('switch', soundEnabled);
      const res = await realityMapperRef.current.togglePiP();
      if (res.success) {
        addLog(res.active ? "VISION_LAYER: DETACHED_PIP_ACTIVE" : "VISION_LAYER: PIP_RESTORED", "system");
      } else {
        addLog(`PIP_STATUS: ${res.reason || 'Switched to Broadcast mode'}`, "system");
        // Seamless fallback to broadcast mode
        setIsBroadcastMode(true);
      }
    }
  };

  const cycleCamera = () => {
    if (videoDevices.length <= 1) return;
    const currentIndex = videoDevices.findIndex(d => d.deviceId === selectedCamera);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    const nextDevice = videoDevices[nextIndex];
    setSelectedCamera(nextDevice.deviceId);
    playTacticalSound('switch', soundEnabled);
    addLog(`SENSOR_SWITCH: ${nextDevice.label || `NODE_${nextIndex + 1}`}`, "system");
  };

  useEffect(() => {
    addLog("SIGHT_OS V9.8.4 INITIALIZED", "system");
    addLog("Binary Reality Engine: ACTIVE", "system");
    addLog("Multimodal Vision Sensor: ONLINE", "system");
    refreshDevices();
    
    const handleDeviceChange = () => refreshDevices();
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth > 1024) {
        setMobileTerminalOpen(false);
      }
    };
    
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    window.addEventListener('resize', handleResize);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      window.removeEventListener('resize', handleResize);
    };
  }, [refreshDevices, addLog]);

  const handleScan = async () => {
    if (mode !== MapMode.IDLE) return;
    setMode(MapMode.SCANNING);
    playTacticalSound('scan', soundEnabled);
    addLog("EXTRACTING_SPATIAL_PRIMITIVES: INITIATED", "input");
    
    setTimeout(async () => {
      setMode(MapMode.ANALYZING);
      const snapshot = realityMapperRef.current?.getSnapshot();
      if (snapshot) {
        try {
          const result = await analyzeSector(snapshot);
          playTacticalSound('beep', soundEnabled);
          addLog(result, "analysis");
        } catch (err: any) {
          playTacticalSound('error', soundEnabled);
          addLog(`ANALYSIS_FAILED: ${err?.message || 'Signal lost'}`, "error");
        }
      } else {
        playTacticalSound('error', soundEnabled);
        addLog("FRAME_BUFFER_EMPTY: Cannot capture frame", "error");
      }
      setMode(MapMode.IDLE);
    }, 1400);
  };

  const handleTakePhoto = () => {
    if (realityMapperRef.current) {
      const dataUrl = realityMapperRef.current.getSnapshot();
      if (dataUrl) {
        playTacticalSound('shutter', soundEnabled);
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `sight_os_matrix_${Date.now()}.png`;
        link.click();
        addLog("IMAGE_CAPTURE: EXPORTED_PNG", "system");
      }
    }
  };

  const handleToggleRecording = async () => {
    if (!realityMapperRef.current) return;
    
    if (isRecording) {
      setIsRecording(false);
      playTacticalSound('record', soundEnabled);
      const blob = await realityMapperRef.current.stopRecording();
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        link.download = `sight_os_stream_${Date.now()}.${ext}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 100);
        addLog(`VIDEO_CAPTURE: EXPORTED_${ext.toUpperCase()}`, "system");
      }
    } else {
      setIsRecording(true);
      playTacticalSound('record', soundEnabled);
      realityMapperRef.current.startRecording();
      addLog("VIDEO_CAPTURE: RECORDING_ACTIVE", "system");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      playTacticalSound('switch', soundEnabled);
      addLog(`SOURCE_LOADED: ${file.name.toUpperCase()}`, "system");
    }
  };

  const handleFileDrop = (file: File) => {
    setUploadedFile(file);
    playTacticalSound('switch', soundEnabled);
    addLog(`SOURCE_INGESTED: ${file.name.toUpperCase()}`, "system");
  };

  const clearUploadedFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    playTacticalSound('switch', soundEnabled);
    addLog("SOURCE_REVERT: REALTIME_OPTICAL_SENSOR", "system");
  };

  const toggleFullscreen = () => {
    playTacticalSound('switch', soundEnabled);
    const doc = document as any;
    const docEl = document.documentElement as any;

    const isFull = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);

    if (!isFull) {
      const requestFn = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
      if (typeof requestFn === 'function') {
        try {
          const p = requestFn.call(docEl);
          if (p && typeof p.catch === 'function') {
            p.catch((err: any) => {
              addLog("FULLSCREEN_SANDBOX: Switched to Immersive Broadcast Mode", "system");
              setIsBroadcastMode(true);
            });
          }
        } catch {
          addLog("FULLSCREEN_OVERRIDE: Immersive Broadcast Mode Active", "system");
          setIsBroadcastMode(true);
        }
      } else {
        // Fallback for browsers/environments where Fullscreen API is unavailable (e.g. mobile Safari / restricted iframe)
        addLog("FULLSCREEN_FALLBACK: Immersive Broadcast Mode Active", "system");
        setIsBroadcastMode(true);
      }
    } else {
      const exitFn = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
      if (typeof exitFn === 'function') {
        try {
          const p = exitFn.call(doc);
          if (p && typeof p.catch === 'function') {
            p.catch(() => {});
          }
        } catch {}
      }
    }
  };

  // Interactive terminal command processor
  const handleTerminalCommand = (cmd: string) => {
    const normalized = cmd.trim().toLowerCase();
    addLog(cmd, 'input');

    if (normalized === 'help' || normalized === '?') {
      addLog("AVAILABLE COMMANDS: scan, snap, rec, rain, color, camera, pip, clear, status, sound, crt, fullscreen", "system");
    } else if (normalized === 'scan' || normalized === 'audit') {
      handleScan();
    } else if (normalized === 'snap' || normalized === 'photo' || normalized === 'capture') {
      handleTakePhoto();
    } else if (normalized === 'rec' || normalized === 'record') {
      handleToggleRecording();
    } else if (normalized === 'rain' || normalized === 'cascade' || normalized === 'waterfall') {
      setCascadingRain(prev => {
        const next = !prev;
        addLog(`CASCADING_RAIN_SCANNER: ${next ? 'ACTIVE (Static field removed - Rain scanner active)' : 'DISABLED (Full static binary field restored)'}`, 'system');
        return next;
      });
    } else if (normalized === 'color') {
      setNaturalColorMode(prev => {
        const next = !prev;
        addLog(`AR_CHROMATIC_OVERLAY: ${next ? 'ENABLED' : 'DISABLED'}`, 'system');
        return next;
      });
    } else if (normalized === 'camera' || normalized === 'cam' || normalized === 'cycle') {
      cycleCamera();
    } else if (normalized === 'pip' || normalized === 'popout') {
      handlePopout();
    } else if (normalized === 'fullscreen') {
      toggleFullscreen();
    } else if (normalized === 'sound' || normalized === 'audio') {
      setSoundEnabled(prev => {
        const next = !prev;
        addLog(`SYNTH_AUDIO_FEEDBACK: ${next ? 'ONLINE' : 'MUTED'}`, 'system');
        return next;
      });
    } else if (normalized === 'crt') {
      setCrtScanlines(prev => {
        const next = !prev;
        addLog(`CRT_SCANLINE_SIM: ${next ? 'ENABLED' : 'DISABLED'}`, 'system');
        return next;
      });
    } else if (normalized === 'status') {
      addLog(`STATUS: OK | FPS: ${telemetry.fps} | RES: ${telemetry.resolution} | CELLS: ${telemetry.cells} | CAM: ${videoDevices.length} available`, 'system');
    } else if (normalized === 'clear' || normalized === 'cls') {
      setLogs([]);
    } else {
      addLog(`UNKNOWN_COMMAND: '${cmd}'. Type 'help' for command list.`, 'error');
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if typing inside an input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.code === 'KeyA' || e.code === 'Space') {
        e.preventDefault();
        handleScan();
      } else if (e.code === 'KeyS') {
        e.preventDefault();
        handleTakePhoto();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        handleToggleRecording();
      } else if (e.code === 'KeyC') {
        e.preventDefault();
        cycleCamera();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'KeyW') {
        e.preventDefault();
        setCascadingRain(prev => {
          const next = !prev;
          addLog(`CASCADING_RAIN_SCANNER: ${next ? 'ACTIVE (Static field removed)' : 'DISABLED (Static field restored)'}`, 'system');
          return next;
        });
      } else if (e.code === 'KeyT') {
        e.preventDefault();
        if (windowWidth < 1024) {
          setMobileTerminalOpen(prev => !prev);
        } else {
          setShowTerminal(prev => !prev);
        }
      } else if (e.code === 'KeyB') {
        e.preventDefault();
        toggleBroadcastMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleScan, isRecording, soundEnabled, windowWidth]);

  const formatTimer = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-black text-green-500 font-mono flex flex-col select-none">
      {cascadingRain && <MatrixRain opacity={0.03} color="#001a00" />}

      <div className={`relative z-10 w-full h-full mx-auto flex flex-col transition-all duration-500 ${isBroadcastMode ? 'p-0' : 'p-2 md:p-3.5 max-w-[1920px] gap-2 md:gap-3'}`}>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept="image/*,video/*" 
          className="hidden" 
        />
        
        {!isBroadcastMode && (
          <header className="flex justify-between items-center border-b border-green-900/30 pb-2 px-1 bg-black/40 backdrop-blur-md relative z-50 shrink-0">
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              {/* Brand Logo */}
              <div className="flex items-center gap-2 pr-2">
                <Cpu className="w-4 h-4 text-green-400 animate-pulse" />
                <h1 className="text-[12px] md:text-xs font-bold tracking-[0.4em] text-green-300 uppercase">
                  Sight_OS
                </h1>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-green-950/70 border border-green-800/60 text-green-400 hidden sm:inline-block font-mono">
                  v9.8
                </span>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-1 md:gap-1.5 pl-2 border-l border-green-900/40">
                <button 
                  onClick={handleScan}
                  disabled={mode !== MapMode.IDLE}
                  className={`px-3 py-1 border rounded transition-all flex items-center gap-1.5 ${
                    mode === MapMode.SCANNING 
                      ? 'border-yellow-500 bg-yellow-950/30 text-yellow-400 animate-pulse' 
                      : mode === MapMode.ANALYZING 
                      ? 'border-cyan-500 bg-cyan-950/30 text-cyan-300 animate-pulse' 
                      : 'border-green-800/80 bg-green-950/20 hover:border-green-400 text-green-400 hover:text-green-200'
                  }`}
                  title="Run Tactical AI Vision Scan (HotKey: Space/A)"
                >
                  <Scan className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">
                    {mode === MapMode.SCANNING ? 'Scanning...' : mode === MapMode.ANALYZING ? 'Analyzing...' : 'Audit'}
                  </span>
                </button>

                <button 
                  onClick={handleTakePhoto}
                  className="p-1.5 border border-green-800/80 bg-green-950/20 hover:border-green-400 text-green-400 hover:text-green-200 rounded transition-all"
                  title="Capture Processed Photo (Hotkey: S)"
                >
                  <Aperture className="w-3.5 h-3.5" />
                </button>

                <button 
                  onClick={handleToggleRecording}
                  className={`p-1.5 border rounded transition-all flex items-center gap-1.5 ${
                    isRecording 
                      ? 'border-red-500 bg-red-950/40 text-red-400 shadow-[0_0_10px_rgba(255,0,0,0.3)] animate-pulse' 
                      : 'border-green-800/80 bg-green-950/20 hover:border-green-400 text-green-400 hover:text-green-200'
                  }`}
                  title={isRecording ? "Stop Video Recording (Hotkey: R)" : "Record Processed Video (Hotkey: R)"}
                >
                  <Video className="w-3.5 h-3.5" />
                  {isRecording && (
                    <span className="text-[9px] font-bold text-red-400 tracking-wider">
                      REC {formatTimer(recordingSeconds)}
                    </span>
                  )}
                </button>

                {/* Cascading Rain Scanner Mode Button */}
                <button 
                  onClick={() => {
                    setCascadingRain(prev => {
                      const next = !prev;
                      addLog(`CASCADING_RAIN_SCANNER: ${next ? 'ACTIVE (Static field removed)' : 'DISABLED (Static field restored)'}`, 'system');
                      return next;
                    });
                  }}
                  className={`p-1.5 border rounded transition-all flex items-center gap-1 ${
                    cascadingRain 
                      ? 'border-green-400 bg-green-950/50 text-green-300 shadow-[0_0_10px_rgba(0,255,0,0.3)] animate-pulse' 
                      : 'border-green-800/80 bg-green-950/20 hover:border-green-400 text-green-400 hover:text-green-200'
                  }`}
                  title={cascadingRain ? "Cascading Rain Scanner Active (Hotkey: W)" : "Toggle Cascading Rain Scanner (Hotkey: W)"}
                >
                  <CloudRain className="w-3.5 h-3.5" />
                  <span className="text-[9px] uppercase font-bold hidden xl:inline">
                    {cascadingRain ? 'Rain On' : 'Rain'}
                  </span>
                </button>

                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-1.5 border rounded transition-all ${
                    uploadedFile 
                      ? 'border-green-400 bg-green-950/40 text-green-300' 
                      : 'border-green-800/80 bg-green-950/20 hover:border-green-400 text-green-400 hover:text-green-200'
                  }`}
                  title="Upload Image/Video or Drag & Drop"
                >
                  <Upload className="w-3.5 h-3.5" />
                </button>

                {uploadedFile && (
                  <button 
                    onClick={clearUploadedFile}
                    className="p-1.5 border border-red-900/70 bg-red-950/20 hover:border-red-500 rounded transition-all text-red-400 hover:text-red-200 flex items-center gap-1"
                    title="Return to Realtime Camera Feed"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="text-[8px] uppercase tracking-wider hidden md:inline">Cam</span>
                  </button>
                )}

                {videoDevices.length > 1 && (
                  <button 
                    onClick={cycleCamera}
                    className="p-1.5 border border-green-800/80 bg-green-950/20 hover:border-green-400 rounded transition-all text-green-400 hover:text-green-200"
                    title="Cycle Camera Sensor (Hotkey: C)"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                )}

                <button 
                  onClick={handlePopout}
                  className="p-1.5 border border-green-800/80 bg-green-950/20 hover:border-green-400 rounded transition-all text-green-400 hover:text-green-200 hidden sm:inline-flex"
                  title="Picture-in-Picture Stream"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>

                <button 
                  onClick={toggleFullscreen}
                  className="p-1.5 border border-green-800/80 bg-green-950/20 hover:border-green-400 rounded transition-all text-green-400 hover:text-green-200 hidden sm:inline-flex"
                  title="Toggle Fullscreen (Hotkey: F)"
                >
                  <Maximize className="w-3.5 h-3.5" />
                </button>

                <button 
                  onClick={toggleBroadcastMode} 
                  className="p-1.5 border border-green-800/80 bg-green-950/20 hover:border-green-400 rounded transition-all text-green-400 hover:text-green-200" 
                  title="Broadcast Mode (Clean Stream Immersion) (Hotkey: B)"
                >
                  <Cast className="w-3.5 h-3.5" />
                </button>

                {/* Mobile Terminal Toggle Button */}
                <button 
                  onClick={() => {
                    if (windowWidth < 1024) {
                      setMobileTerminalOpen(!mobileTerminalOpen);
                    } else {
                      setShowTerminal(!showTerminal);
                    }
                  }}
                  className={`p-1.5 border rounded transition-all lg:hidden ${
                    mobileTerminalOpen ? 'border-green-400 bg-green-950/40 text-green-300' : 'border-green-800/80 bg-green-950/20 text-green-400'
                  }`}
                  title="Toggle Diagnostic Terminal"
                >
                  <Terminal className="w-3.5 h-3.5" />
                </button>

                <button 
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className={`p-1.5 border transition-all rounded ${
                    isMenuOpen ? 'border-green-400 bg-green-950/40 text-green-300' : 'border-green-800/80 bg-green-950/20 hover:border-green-400 text-green-400'
                  }`}
                  title="System Configuration"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            
            {/* Live Telemetry Readout */}
            <div className="flex items-center gap-3 text-[9px] text-green-700 tracking-wider font-mono hidden sm:flex">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                {telemetry.fps} FPS
              </span>
              <span className="border-l border-green-900/40 pl-3">
                {telemetry.resolution}
              </span>
              {uploadedFile ? (
                <span className="border-l border-green-900/40 pl-3 text-cyan-400 font-bold truncate max-w-[120px]">
                  FILE: {uploadedFile.name}
                </span>
              ) : (
                <span className="border-l border-green-900/40 pl-3 text-green-600">
                  LIVE_FEED
                </span>
              )}
            </div>
          </header>
        )}

        {/* Center Main Stage */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-2 md:gap-3 min-h-0 relative">
          <div className={`${isBroadcastMode ? 'fixed inset-0 z-[100]' : `${showTerminal ? 'lg:col-span-3' : 'lg:col-span-4'} relative group h-full flex flex-col`}`}>
            <div className={`flex-1 relative overflow-hidden bg-black ${isBroadcastMode ? 'w-full h-full' : 'border border-green-900/40 rounded shadow-[0_0_15px_rgba(0,255,0,0.05)]'}`}>
              
              {/* Broadcast exit button */}
              {isBroadcastMode && (
                <button 
                  onClick={toggleBroadcastMode} 
                  className="absolute top-4 right-4 z-[110] p-3 bg-black/60 backdrop-blur-lg border border-green-800 text-green-400 rounded-full hover:bg-green-950/80 transition-all opacity-40 hover:opacity-100"
                  title="Exit Broadcast Mode"
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
              )}

              {/* Upload source badge in viewer */}
              {uploadedFile && !isBroadcastMode && (
                <div className="absolute top-3 left-3 z-30 flex items-center gap-2 px-2.5 py-1 bg-black/80 border border-green-800/80 rounded backdrop-blur-md text-[10px] text-green-300">
                  {uploadedFile.type.startsWith('video/') ? (
                    <FileVideo className="w-3.5 h-3.5 text-cyan-400" />
                  ) : (
                    <FileImage className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                  <span className="font-bold truncate max-w-[180px]">{uploadedFile.name}</span>
                  <button 
                    onClick={clearUploadedFile} 
                    className="ml-1 text-red-400 hover:text-red-300 font-bold px-1 hover:bg-red-950/40 rounded"
                    title="Close file and return to camera"
                  >
                    ×
                  </button>
                </div>
              )}

              <RealityMapper 
                ref={realityMapperRef}
                isScanning={mode === MapMode.SCANNING} 
                mode={mode}
                showColor={naturalColorMode}
                cascadingRain={cascadingRain}
                showFeed={false}
                gridSize={currentGridSize}
                enableZoom={!isBroadcastMode}
                sensitivity={sensitivity}
                refraction={0}
                diffusion={0}
                ambientLight={0}
                bloomThreshold={90}
                range={50}
                decayScale={decayScale}
                streamTrailDecayScale={streamTrailDecay}
                isEnhanced={true}
                luminanceModel="rec601"
                edgeStrength={0}
                contrastGamma={85}
                rainInterference={0}
                selectedDeviceId={selectedCamera}
                onStreamActive={() => refreshDevices()}
                uploadedFile={uploadedFile}
                onFileDrop={handleFileDrop}
                onTelemetryUpdate={setTelemetry}
              />
            </div>
          </div>

          {/* Desktop Diagnostic Console */}
          {!isBroadcastMode && showTerminal && (
            <div className="hidden lg:flex flex-col gap-2 min-h-0">
              <TerminalOutput 
                logs={logs} 
                onClose={() => setShowTerminal(false)}
                onClearLogs={() => setLogs([])}
                onExecuteCommand={handleTerminalCommand}
              />
            </div>
          )}

          {/* Mobile Diagnostic Drawer */}
          <AnimatePresence>
            {!isBroadcastMode && mobileTerminalOpen && (
              <motion.div 
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed inset-x-2 bottom-2 top-24 z-[150] lg:hidden flex flex-col"
              >
                <TerminalOutput 
                  logs={logs} 
                  onClose={() => setMobileTerminalOpen(false)}
                  onClearLogs={() => setLogs([])}
                  onExecuteCommand={handleTerminalCommand}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Settings Configuration Modal */}
          <AnimatePresence>
            {isMenuOpen && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsMenuOpen(false)}
                  className="absolute inset-0 bg-black/85 backdrop-blur-md"
                />
                
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  className="relative w-full max-w-md bg-zinc-950 border border-green-800/60 rounded-xl shadow-[0_0_30px_rgba(0,255,0,0.15)] overflow-hidden flex flex-col font-mono"
                >
                  <div className="p-4 border-b border-green-900/40 flex justify-between items-center bg-green-950/20">
                    <div className="flex items-center gap-2.5">
                      <Settings className="w-4 h-4 text-green-400 animate-spin-slow" />
                      <h2 className="text-xs font-bold tracking-[0.3em] uppercase text-green-400">Tactical Configuration</h2>
                    </div>
                    <button 
                      onClick={() => setIsMenuOpen(false)}
                      className="p-1.5 hover:bg-green-900/30 rounded-full transition-colors text-green-600 hover:text-green-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Camera Selection */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-green-600 text-[10px] font-bold uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <Camera className="w-3.5 h-3.5 text-green-500" />
                          <span>Optical Sensor Link</span>
                        </div>
                        <button 
                          onClick={refreshDevices}
                          className="hover:text-green-300 flex items-center gap-1 text-[9px]"
                          title="Refresh Sensors"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          Probe
                        </button>
                      </div>
                      <div className="relative">
                        <select 
                          value={selectedCamera} 
                          onChange={(e) => setSelectedCamera(e.target.value)}
                          className="w-full bg-black border border-green-900/60 text-green-300 text-xs p-2.5 rounded outline-none focus:border-green-400 transition-all appearance-none cursor-pointer hover:border-green-700"
                        >
                          {videoDevices.length === 0 && <option value="">Probing Hardware Sensors...</option>}
                          {videoDevices.map((device, idx) => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label || `Optical Sensor Node ${idx + 1}`}
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-green-800">
                          <Layers className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>

                    {/* Stream Persistence Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider">
                        <div className="flex items-center gap-2 text-green-600">
                          <Activity className="w-3.5 h-3.5 text-green-500" />
                          <span>Temporal Trail Persistence</span>
                        </div>
                        <span className="text-green-400 font-mono">{streamTrailDecay}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={streamTrailDecay} 
                        onChange={(e) => setStreamTrailDecay(Number(e.target.value))} 
                        className="w-full accent-green-400 h-1.5 bg-green-950/60 rounded appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-[8px] text-green-800 uppercase">
                        <span>Realtime Instant</span>
                        <span>Full Ghosting Echo</span>
                      </div>
                    </div>

                    {/* Toggles Grid */}
                    <div className="space-y-2.5">
                      <button 
                        onClick={() => {
                          setCascadingRain(!cascadingRain);
                          addLog(`CASCADING_RAIN_SCANNER: ${!cascadingRain ? 'ACTIVE (Static field removed - Rain scanner active)' : 'DISABLED (Static binary field restored)'}`, 'system');
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded border transition-all ${
                          cascadingRain ? 'bg-green-950/30 border-green-500/60 text-green-300' : 'bg-black border-green-900/30 text-green-700 hover:border-green-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <CloudRain className="w-3.5 h-3.5 text-green-500" />
                          <div className="text-left">
                            <div className="text-[10px] font-bold uppercase tracking-wider">Cascading Rain Scanner Mode</div>
                            <div className="text-[8px] text-green-700 normal-case">Removes static binary; reveals camera only through falling rain</div>
                          </div>
                        </div>
                        <div className={`w-7 h-3.5 rounded-full relative transition-colors ${cascadingRain ? 'bg-green-600' : 'bg-zinc-800'}`}>
                          <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${cascadingRain ? 'right-0.5' : 'left-0.5'}`} />
                        </div>
                      </button>

                      <button 
                        onClick={() => setNaturalColorMode(!naturalColorMode)}
                        className={`w-full flex items-center justify-between p-3 rounded border transition-all ${
                          naturalColorMode ? 'bg-green-950/30 border-green-500/60 text-green-300' : 'bg-black border-green-900/30 text-green-700 hover:border-green-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Layers className="w-3.5 h-3.5 text-green-500" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">AR Chromatic Tint Layer</span>
                        </div>
                        <div className={`w-7 h-3.5 rounded-full relative transition-colors ${naturalColorMode ? 'bg-green-600' : 'bg-zinc-800'}`}>
                          <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${naturalColorMode ? 'right-0.5' : 'left-0.5'}`} />
                        </div>
                      </button>

                      <button 
                        onClick={() => setCrtScanlines(!crtScanlines)}
                        className={`w-full flex items-center justify-between p-3 rounded border transition-all ${
                          crtScanlines ? 'bg-green-950/30 border-green-500/60 text-green-300' : 'bg-black border-green-900/30 text-green-700 hover:border-green-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Tv className="w-3.5 h-3.5 text-green-500" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">CRT Scanline & Phosphor Flicker</span>
                        </div>
                        <div className={`w-7 h-3.5 rounded-full relative transition-colors ${crtScanlines ? 'bg-green-600' : 'bg-zinc-800'}`}>
                          <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${crtScanlines ? 'right-0.5' : 'left-0.5'}`} />
                        </div>
                      </button>

                      <button 
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={`w-full flex items-center justify-between p-3 rounded border transition-all ${
                          soundEnabled ? 'bg-green-950/30 border-green-500/60 text-green-300' : 'bg-black border-green-900/30 text-green-700 hover:border-green-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-green-500" /> : <VolumeX className="w-3.5 h-3.5 text-green-700" />}
                          <span className="text-[10px] font-bold uppercase tracking-wider">Cybernetic Audio Synthesizer</span>
                        </div>
                        <div className={`w-7 h-3.5 rounded-full relative transition-colors ${soundEnabled ? 'bg-green-600' : 'bg-zinc-800'}`}>
                          <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${soundEnabled ? 'right-0.5' : 'left-0.5'}`} />
                        </div>
                      </button>

                      <button 
                        onClick={() => setShowTerminal(!showTerminal)}
                        className={`w-full flex items-center justify-between p-3 rounded border transition-all ${
                          showTerminal ? 'bg-green-950/30 border-green-500/60 text-green-300' : 'bg-black border-green-900/30 text-green-700 hover:border-green-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Terminal className="w-3.5 h-3.5 text-green-500" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Telemetry Diagnostic Console</span>
                        </div>
                        <div className={`w-7 h-3.5 rounded-full relative transition-colors ${showTerminal ? 'bg-green-600' : 'bg-zinc-800'}`}>
                          <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${showTerminal ? 'right-0.5' : 'left-0.5'}`} />
                        </div>
                      </button>
                    </div>

                    {/* Keyboard Shortcuts Sheet */}
                    <div className="p-3 bg-black/60 border border-green-900/40 rounded space-y-1.5">
                      <div className="flex items-center gap-1.5 text-green-500 text-[10px] font-bold uppercase">
                        <HelpCircle className="w-3 h-3" />
                        <span>Tactical Keyboard Shortcuts</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px] text-green-700">
                        <div><span className="text-green-400 font-bold">Space/A</span> : Tactical Audit</div>
                        <div><span className="text-green-400 font-bold">S</span> : Capture Snapshot</div>
                        <div><span className="text-green-400 font-bold">R</span> : Toggle Video Rec</div>
                        <div><span className="text-green-400 font-bold">W</span> : Rain Scanner</div>
                        <div><span className="text-green-400 font-bold">C</span> : Cycle Sensor Node</div>
                        <div><span className="text-green-400 font-bold">F</span> : Fullscreen</div>
                        <div><span className="text-green-400 font-bold">B</span> : Broadcast Mode</div>
                        <div><span className="text-green-400 font-bold">T</span> : Toggle Console</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-green-950/20 border-t border-green-900/30 flex gap-2">
                    <button 
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-black font-bold text-[10px] uppercase tracking-[0.3em] rounded transition-all"
                    >
                      Commit & Close
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Tactical Footer */}
        {!isBroadcastMode && (
          <footer className="flex justify-between items-center text-[8px] text-green-800 tracking-[0.4em] uppercase shrink-0 border-t border-green-900/20 pt-1.5 px-1 font-mono">
            <div className="flex items-center gap-3">
              <span>UPTIME: {Math.floor(performance.now() / 1000)}S</span>
              <span className="hidden sm:inline text-green-900">|</span>
              <span className="hidden sm:inline">NODES: {videoDevices.length} ACTIVE</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-green-700">KERNEL: V9.8.4-STABLE</span>
              <span className="text-green-600 font-bold">SECURE_L4</span>
            </div>
          </footer>
        )}

      </div>
    </div>
  );
};

export default App;
