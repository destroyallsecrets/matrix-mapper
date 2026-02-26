
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import MatrixRain from './components/MatrixRain';
import RealityMapper, { RealityMapperHandle } from './components/RealityMapper';
import TerminalOutput from './components/TerminalOutput';
import { analyzeSector } from './services/geminiService';
import { LogEntry, MapMode } from './types';
import { Cpu, Settings, X, Scan, Cast, Minimize2, Terminal, Layers, Camera, Activity, ExternalLink, Video, Aperture } from 'lucide-react';

const App: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [mode, setMode] = useState<MapMode>(MapMode.IDLE);
  const realityMapperRef = useRef<RealityMapperHandle>(null);
  
  // UI States
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBroadcastMode, setIsBroadcastMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Calibration defaults for realistic binary sight
  const [naturalColorMode, setNaturalColorMode] = useState(false);
  const [showTerminal, setShowTerminal] = useState(window.innerWidth > 1024);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [streamTrailDecay, setStreamTrailDecay] = useState(0);
  
  // Window size state for responsiveness
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Tactical simulation constants
  const sensitivity = 85; 
  const density = 85; 
  const decayScale = 12; // Zero-Ghosting tuning for the void
  
  const isMobile = windowWidth < 768;
  const baseGrid = isMobile ? 7 : 9;
  const currentGridSize = Math.max(isMobile ? 5 : 4, Math.round(32 - (density / 100) * (32 - baseGrid)));

  const addLog = (message: string, type: LogEntry['type'] = 'system') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      message,
      type
    };
    setLogs(prev => [...prev.slice(-49), newLog]);
  };

  const refreshDevices = async () => {
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
  };

  const toggleBroadcastMode = () => {
    setIsBroadcastMode(prev => {
      const next = !prev;
      addLog(next ? "SIGHT_UPLINK: ENCRYPTED" : "INTERFACE_REVERT: LOCAL", "system");
      return next;
    });
  };

  const handlePopout = () => {
      if (realityMapperRef.current) {
          realityMapperRef.current.togglePiP();
          addLog("VISION_LAYER: DETACHED", "system");
      }
  };

  useEffect(() => {
    addLog("SIGHT_OS V9.6 STABLE LOADED", "system");
    addLog("Binary Mapping: REALISTIC_LOGIC", "system");
    addLog("Video Sync: CALIBRATED", "system");
    refreshDevices();
    
    const handleDeviceChange = () => refreshDevices();
    const handleResize = () => setWindowWidth(window.innerWidth);
    
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    window.addEventListener('resize', handleResize);
    
    return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
        window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleScan = async () => {
    if (mode !== MapMode.IDLE) return;
    setMode(MapMode.SCANNING);
    addLog("Extracting spatial primitives...", "input");
    setTimeout(async () => {
        setMode(MapMode.ANALYZING);
        const snapshot = realityMapperRef.current?.getSnapshot();
        if (snapshot) {
            const result = await analyzeSector(snapshot);
            addLog(result, "analysis");
        }
        setMode(MapMode.IDLE);
    }, 2000);
  };

  const handleTakePhoto = () => {
    if (realityMapperRef.current) {
      const dataUrl = realityMapperRef.current.getSnapshot();
      if (dataUrl) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `sight_os_capture_${Date.now()}.png`;
        link.click();
        addLog("IMAGE_CAPTURE: SAVED", "system");
      }
    }
  };

  const handleToggleRecording = async () => {
    if (!realityMapperRef.current) return;
    
    if (isRecording) {
      setIsRecording(false);
      const blob = await realityMapperRef.current.stopRecording();
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sight_os_record_${Date.now()}.webm`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 100);
        addLog("VIDEO_CAPTURE: SAVED", "system");
      }
    } else {
      setIsRecording(true);
      realityMapperRef.current.startRecording();
      addLog("VIDEO_CAPTURE: STARTED", "system");
    }
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-black text-green-500 font-mono flex flex-col">
      <MatrixRain opacity={0.02} color="#000d00" />

      <div className={`relative z-10 w-full h-full mx-auto flex flex-col transition-all duration-500 ${isBroadcastMode ? 'p-0' : 'p-2 md:p-4 max-w-[1920px] gap-2 md:gap-4'}`}>
        
        {!isBroadcastMode && (
        <header className="flex justify-between items-center border-b border-green-900/20 pb-2 bg-black/30 backdrop-blur-sm relative z-50 shrink-0">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-green-600" />
              <h1 className="text-[11px] md:text-xs font-bold tracking-[0.6em] text-green-800 uppercase">Sight_OS</h1>
            </div>
            
            <div className="flex items-center gap-1 md:gap-2 pl-4 border-l border-green-900/30">
                <button 
                    onClick={handleScan}
                    disabled={mode !== MapMode.IDLE}
                    className={`px-4 py-1 border rounded-sm transition-all flex items-center gap-2 ${mode === MapMode.SCANNING ? 'border-yellow-600 text-yellow-600 animate-pulse' : 'border-green-900/50 hover:border-green-500 text-green-900 hover:text-green-500'}`}
                >
                    <Scan className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-bold uppercase tracking-widest hidden sm:inline">Audit</span>
                </button>

                <button 
                    onClick={handleTakePhoto}
                    className="p-1.5 border border-green-900/50 hover:border-green-500 rounded-sm transition-all text-green-900 hover:text-green-500"
                    title="Capture Photo"
                >
                    <Aperture className="w-3.5 h-3.5" />
                </button>

                <button 
                    onClick={handleToggleRecording}
                    className={`p-1.5 border rounded-sm transition-all ${isRecording ? 'border-red-600 text-red-600 animate-pulse' : 'border-green-900/50 hover:border-green-500 text-green-900 hover:text-green-500'}`}
                    title={isRecording ? "Stop Recording" : "Record Video"}
                >
                    <Video className="w-3.5 h-3.5" />
                </button>

                <button 
                    onClick={handlePopout}
                    className="p-1.5 border border-green-900/50 hover:border-green-500 rounded-sm transition-all text-green-900 hover:text-green-500"
                    title="Popout Vision (PiP)"
                >
                    <ExternalLink className="w-3.5 h-3.5" />
                </button>

                <button onClick={toggleBroadcastMode} className="p-1.5 border border-green-900/50 hover:border-green-500 rounded-sm transition-all" title="Broadcast Mode (Clean UI)">
                    <Cast className="w-3.5 h-3.5 text-green-900" />
                </button>

                <button 
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className={`p-1.5 border transition-all ${isMenuOpen ? 'border-green-500 bg-green-950/20' : 'border-green-900/50 hover:border-green-500'} rounded-sm`}
                >
                  <Settings className="w-3.5 h-3.5 text-green-900" />
                </button>
            </div>
          </div>
          
          <div className="text-[8px] text-green-950 text-right uppercase tracking-[0.4em] hidden sm:block">
             Binary Sight Reality Integration // v9.6
          </div>
        </header>
        )}

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-2 md:gap-4 min-h-0 relative">
          <div className={`${isBroadcastMode ? 'fixed inset-0 z-[100]' : `${showTerminal ? 'lg:col-span-3' : 'lg:col-span-4'} relative group h-full flex flex-col`}`}>
            <div className={`flex-1 relative overflow-hidden bg-black ${isBroadcastMode ? 'w-full h-full' : 'border border-green-900/30 rounded-sm'}`}>
                
                {isBroadcastMode && (
                    <button onClick={toggleBroadcastMode} className="absolute top-6 right-6 z-[110] p-4 bg-black/40 backdrop-blur-lg border border-green-900/40 rounded-full opacity-30 hover:opacity-100 transition-all">
                        <Minimize2 className="w-4 h-4" />
                    </button>
                )}

                <RealityMapper 
                  ref={realityMapperRef}
                  isScanning={mode === MapMode.SCANNING} 
                  mode={mode}
                  showColor={naturalColorMode}
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
                />
            </div>
          </div>

          {!isBroadcastMode && showTerminal && (
            <div className="hidden lg:flex flex-col gap-2 min-h-0">
                <TerminalOutput 
                    logs={logs} 
                    onClose={() => setShowTerminal(false)}
                />
            </div>
          )}

          <AnimatePresence>
            {isMenuOpen && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsMenuOpen(false)}
                  className="absolute inset-0 bg-black/80 backdrop-blur-md"
                />
                
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative w-full max-w-md bg-zinc-950 border border-green-900/30 rounded-xl shadow-2xl overflow-hidden flex flex-col"
                >
                  <div className="p-4 border-b border-green-900/20 flex justify-between items-center bg-green-950/5">
                    <div className="flex items-center gap-3">
                      <Settings className="w-4 h-4 text-green-500" />
                      <h2 className="text-xs font-bold tracking-[0.3em] uppercase text-green-500">System Configuration</h2>
                    </div>
                    <button 
                      onClick={() => setIsMenuOpen(false)}
                      className="p-2 hover:bg-green-900/20 rounded-full transition-colors text-green-700 hover:text-green-400"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Camera Selection */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-green-700">
                        <Camera className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Optical Sensor Input</span>
                      </div>
                      <div className="relative">
                        <select 
                          value={selectedCamera} 
                          onChange={(e) => setSelectedCamera(e.target.value)}
                          className="w-full bg-black border border-green-900/40 text-green-400 text-sm p-3 rounded-lg outline-none focus:border-green-500 transition-all appearance-none cursor-pointer hover:border-green-700"
                        >
                          {videoDevices.length === 0 && <option value="">Probing Hardware...</option>}
                          {videoDevices.map((device, idx) => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label || `Sensor Node ${idx + 1}`}
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-green-900">
                          <Layers className="w-4 h-4" />
                        </div>
                      </div>
                    </div>

                    {/* Stream Persistence */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3 text-green-700">
                          <Activity className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Temporal Persistence</span>
                        </div>
                        <span className="text-[10px] text-green-500 font-mono">{streamTrailDecay}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={streamTrailDecay} 
                        onChange={(e) => setStreamTrailDecay(Number(e.target.value))} 
                        className="w-full accent-green-500 h-1.5 bg-green-900/20 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-[8px] text-green-900 uppercase tracking-tighter">
                        <span>Real-time</span>
                        <span>Ghosting</span>
                      </div>
                    </div>

                    {/* Toggles */}
                    <div className="grid grid-cols-1 gap-3">
                      <button 
                        onClick={() => setNaturalColorMode(!naturalColorMode)}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-all ${naturalColorMode ? 'bg-green-950/20 border-green-500/50 text-green-400' : 'bg-black border-green-900/20 text-green-800 hover:border-green-900/50'}`}
                      >
                        <div className="flex items-center gap-3">
                          <Layers className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">AR Chromatic Overlay</span>
                        </div>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${naturalColorMode ? 'bg-green-600' : 'bg-zinc-800'}`}>
                          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all ${naturalColorMode ? 'right-1' : 'left-1'}`} />
                        </div>
                      </button>

                      <button 
                        onClick={() => setShowTerminal(!showTerminal)}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-all ${showTerminal ? 'bg-green-950/20 border-green-500/50 text-green-400' : 'bg-black border-green-900/20 text-green-800 hover:border-green-900/50'}`}
                      >
                        <div className="flex items-center gap-3">
                          <Terminal className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Diagnostic Console</span>
                        </div>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${showTerminal ? 'bg-green-600' : 'bg-zinc-800'}`}>
                          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all ${showTerminal ? 'right-1' : 'left-1'}`} />
                        </div>
                      </button>
                    </div>

                    <div className="pt-6 border-t border-green-900/10 flex flex-col gap-2">
                      <div className="flex justify-between text-[8px] text-green-900 uppercase tracking-[0.3em]">
                        <span>Kernel Version</span>
                        <span>v9.6.2-stable</span>
                      </div>
                      <div className="flex justify-between text-[8px] text-green-900 uppercase tracking-[0.3em]">
                        <span>Security Protocol</span>
                        <span>Encrypted-L3</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-green-950/5 border-t border-green-900/10">
                    <button 
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full py-3 bg-green-600 hover:bg-green-500 text-black font-bold text-[10px] uppercase tracking-[0.4em] rounded-lg transition-all shadow-lg shadow-green-900/20"
                    >
                      Apply Parameters
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>

        {!isBroadcastMode && (
        <footer className="flex justify-between text-[7px] text-green-950 tracking-[0.5em] uppercase shrink-0 border-t border-green-900/10 pt-2 opacity-60">
          <div>SESSION_UPTIME: {Math.floor(performance.now() / 1000)}S</div>
          <div className="hidden xs:block">SYSTEM_INTEGRITY: 100%</div>
        </footer>
        )}

      </div>
    </div>
  );
};

export default App;
