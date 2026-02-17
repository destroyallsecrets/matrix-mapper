import React, { useState, useEffect, useRef } from 'react';
import MatrixRain from './components/MatrixRain';
import RealityMapper, { RealityMapperHandle } from './components/RealityMapper';
import TerminalOutput from './components/TerminalOutput';
import { LogEntry, MapMode } from './types';
import { Cpu, Settings, Grid, Layers, X, MonitorUp, MousePointer2, Activity, Waves, Zap, ChevronsDown } from 'lucide-react';

const App: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [mode, setMode] = useState<MapMode>(MapMode.IDLE);
  const realityMapperRef = useRef<RealityMapperHandle>(null);
  
  // Menu & Feature States
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [naturalColorMode, setNaturalColorMode] = useState(false);
  const [isExternalActive, setIsExternalActive] = useState(false);
  const [zoomEnabled, setZoomEnabled] = useState(true);
  
  // Visual Simulation Parameters
  const [density, setDensity] = useState<number>(75);
  const [sensitivity, setSensitivity] = useState<number>(60); // Signal Sensitivity
  const [refraction, setRefraction] = useState<number>(85);   // Light Decay / Refraction
  const [range, setRange] = useState<number>(50);             // Pulse Frequency / Speed
  const [decayScale, setDecayScale] = useState<number>(30);   // Trail Length / Decay Scale

  // Constants for Grid Calculation
  const MAX_GRID_PX = 48; // Largest pixel size (Low Density)
  const MIN_GRID_PX = 6;  // Smallest pixel size (High Density)

  // Calculate actual grid size based on density percentage
  // Inverted: Higher density = Lower grid size
  const currentGridSize = Math.round(MAX_GRID_PX - (density / 100) * (MAX_GRID_PX - MIN_GRID_PX));
  
  const addLog = (message: string, type: LogEntry['type'] = 'system') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      message,
      type
    };
    setLogs(prev => {
        const updated = [...prev, newLog];
        // Keep logs from growing indefinitely
        if (updated.length > 100) return updated.slice(updated.length - 100);
        return updated;
    });
  };

  // Initial Boot
  useEffect(() => {
    addLog("Matrix Spatial Mapper OS v5.3 initialized...", "system");
    addLog("Calibrating optical refraction sensors...", "system");
  }, []);

  const toggleNaturalColor = () => {
    setNaturalColorMode(!naturalColorMode);
    addLog(`Visual filter updated: ${!naturalColorMode ? 'NATURAL_COLOR' : 'MONOCHROME_GREEN'}`, "system");
  };

  const toggleZoom = () => {
    setZoomEnabled(!zoomEnabled);
    addLog(`Interactive Zoom: ${!zoomEnabled ? 'ENABLED' : 'DISABLED'}`, "system");
  };

  const handleDensityChange = (e: React.ChangeEvent<HTMLInputElement>) => setDensity(parseInt(e.target.value, 10));
  const handleSensitivityChange = (e: React.ChangeEvent<HTMLInputElement>) => setSensitivity(parseInt(e.target.value, 10));
  const handleRefractionChange = (e: React.ChangeEvent<HTMLInputElement>) => setRefraction(parseInt(e.target.value, 10));
  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => setRange(parseInt(e.target.value, 10));
  const handleDecayScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => setDecayScale(parseInt(e.target.value, 10));

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-black text-green-500 font-mono flex flex-col">
      {/* Background Effect */}
      <MatrixRain opacity={0.1} color="#003300" />

      {/* Main UI Container */}
      <div className="relative z-10 w-full h-full max-w-[1920px] mx-auto p-2 md:p-4 flex flex-col gap-4">
        
        {/* Header */}
        <header className="flex justify-between items-center border-b border-green-900 pb-2 bg-black/50 backdrop-blur-sm relative z-50 shrink-0">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 md:w-6 md:h-6 animate-pulse text-green-400" />
              <h1 className="text-lg md:text-xl font-bold tracking-widest glow-text truncate">MATRIX // REALITY</h1>
            </div>
            
            <div className="flex items-center gap-2">
                {/* External Feed Button */}
                <button 
                    onClick={() => realityMapperRef.current?.toggleExternalWindow()}
                    className={`p-2 md:p-1 border ${isExternalActive ? 'border-green-400 bg-green-900/40 text-green-400' : 'border-green-900 hover:border-green-600'} rounded transition-all active:scale-95`}
                    title={isExternalActive ? "Close External Feed" : "Pop-out External Feed"}
                    aria-label="Toggle External Feed"
                >
                    <MonitorUp className={`w-5 h-5 md:w-4 md:h-4 ${isExternalActive ? 'animate-pulse' : ''}`} />
                </button>

                {/* Feature Menu Toggle */}
                <button 
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className={`p-2 md:p-1 border ${isMenuOpen ? 'border-green-400 bg-green-900/40' : 'border-green-900 hover:border-green-600'} rounded transition-all active:scale-95`}
                  title="System Configuration"
                  aria-label="Toggle Settings"
                >
                  {isMenuOpen ? <X className="w-5 h-5 md:w-4 md:h-4" /> : <Settings className="w-5 h-5 md:w-4 md:h-4" />}
                </button>
            </div>
          </div>
          
          <div className="text-[10px] md:text-xs text-green-700 flex flex-col items-end leading-tight">
             <span>SENS: {sensitivity} | REFR: {refraction}</span>
             <span>SCALE: {decayScale} | PULSE: {range}</span>
          </div>
        </header>

        {/* Content Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 relative">
          
          {/* Main Viewport (Visualizer) */}
          <div className="lg:col-span-2 flex flex-col gap-4 min-h-0 h-full relative group">
            <div className="flex-1 relative border border-green-900 bg-black/50 rounded-lg overflow-hidden shadow-[0_0_15px_rgba(0,255,0,0.1)]">
                {/* Corner Accents */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-green-500 z-20 pointer-events-none opacity-50"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-green-500 z-20 pointer-events-none opacity-50"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-green-500 z-20 pointer-events-none opacity-50"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-green-500 z-20 pointer-events-none opacity-50"></div>
                
                <RealityMapper 
                  ref={realityMapperRef}
                  isScanning={mode === MapMode.SCANNING} 
                  mode={mode}
                  showColor={naturalColorMode}
                  gridSize={currentGridSize}
                  enableZoom={zoomEnabled}
                  sensitivity={sensitivity}
                  refraction={refraction}
                  range={range}
                  decayScale={decayScale}
                  onExternalStateChange={setIsExternalActive}
                />
            </div>
          </div>

          {/* Desktop Terminal */}
          <div className="hidden lg:flex flex-col gap-2 min-h-0 h-full">
            <TerminalOutput logs={logs} />
          </div>

          {/* SETTINGS PANEL (Non-blocking Overlay) */}
          <aside 
            className={`
              fixed z-40 bg-black/95 border-green-800 shadow-[0_0_30px_rgba(0,0,0,0.9)] transition-transform duration-300 ease-in-out
              /* Mobile: Bottom Sheet */
              max-lg:inset-x-0 max-lg:bottom-0 max-lg:border-t max-lg:rounded-t-2xl max-lg:h-[60vh] max-lg:pb-8
              ${isMenuOpen ? 'max-lg:translate-y-0' : 'max-lg:translate-y-[110%]'}
              
              /* Desktop: Right Floating Panel */
              lg:absolute lg:top-0 lg:right-0 lg:bottom-0 lg:w-full lg:max-w-sm lg:border lg:rounded-lg lg:bg-black/90
              ${isMenuOpen ? 'lg:translate-x-0' : 'lg:translate-x-[110%]'}
            `}
          >
             <div className="h-full flex flex-col overflow-hidden">
                {/* Panel Header */}
                <div className="p-3 border-b border-green-900 text-xs font-bold text-green-500 uppercase flex justify-between items-center bg-green-900/10">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    <span>Configuration Matrix</span>
                  </div>
                  <button onClick={() => setIsMenuOpen(false)} className="hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  
                  {/* Toggles */}
                  <div className="space-y-3">
                    <label className="flex items-center justify-between cursor-pointer active:bg-green-900/20 p-2 -mx-2 rounded transition-colors group">
                      <div className="flex items-center gap-3">
                        <MousePointer2 className="w-5 h-5 text-green-600" />
                        <span className="text-sm font-medium text-green-400 group-hover:text-green-300">Interactive Zoom</span>
                      </div>
                      <div className="relative">
                        <input type="checkbox" checked={zoomEnabled} onChange={toggleZoom} className="sr-only peer" />
                        <div className="w-11 h-6 bg-green-900/50 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                      </div>
                    </label>

                    <label className="flex items-center justify-between cursor-pointer active:bg-green-900/20 p-2 -mx-2 rounded transition-colors group">
                      <div className="flex items-center gap-3">
                        <Layers className="w-5 h-5 text-green-600" />
                        <span className="text-sm font-medium text-green-400 group-hover:text-green-300">Natural Color</span>
                      </div>
                      <div className="relative">
                        <input type="checkbox" checked={naturalColorMode} onChange={toggleNaturalColor} className="sr-only peer" />
                        <div className="w-11 h-6 bg-green-900/50 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                      </div>
                    </label>
                  </div>

                  <div className="border-t border-green-900/30"></div>

                  {/* Sliders */}
                  <div className="space-y-6">
                    {/* Signal Sensitivity */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-green-600" />
                            <span className="text-xs font-bold text-green-500 uppercase">Signal Sensitivity</span>
                        </div>
                        <span className="text-[10px] text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded">{sensitivity}%</span>
                      </div>
                      <div className="relative h-6 flex items-center group">
                        <div className="absolute w-full h-1.5 bg-green-900/50 rounded-full overflow-hidden">
                           <div className="h-full bg-green-500 transition-all duration-75" style={{ width: `${sensitivity}%` }} />
                        </div>
                        <input type="range" min="0" max="100" value={sensitivity} onChange={handleSensitivityChange} className="absolute w-full h-full opacity-0 cursor-pointer" />
                        <div className="absolute h-4 w-4 bg-black border-2 border-green-500 rounded-full shadow-[0_0_5px_#0f0] pointer-events-none transform -translate-x-1/2 transition-all duration-75 group-active:scale-125" style={{ left: `${sensitivity}%` }} />
                      </div>
                    </div>

                    {/* Light Refraction */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Waves className="w-4 h-4 text-green-600" />
                            <span className="text-xs font-bold text-green-500 uppercase">Signal Refraction</span>
                        </div>
                        <span className="text-[10px] text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded">{refraction}%</span>
                      </div>
                      <div className="relative h-6 flex items-center group">
                        <div className="absolute w-full h-1.5 bg-green-900/50 rounded-full overflow-hidden">
                           <div className="h-full bg-cyan-500 transition-all duration-75" style={{ width: `${refraction}%` }} />
                        </div>
                        <input type="range" min="0" max="100" value={refraction} onChange={handleRefractionChange} className="absolute w-full h-full opacity-0 cursor-pointer" />
                        <div className="absolute h-4 w-4 bg-black border-2 border-cyan-500 rounded-full shadow-[0_0_5px_cyan] pointer-events-none transform -translate-x-1/2 transition-all duration-75 group-active:scale-125" style={{ left: `${refraction}%` }} />
                      </div>
                    </div>

                    {/* Decay Scale */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ChevronsDown className="w-4 h-4 text-green-600" />
                            <span className="text-xs font-bold text-green-500 uppercase">Decay Scale</span>
                        </div>
                        <span className="text-[10px] text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded">{decayScale}%</span>
                      </div>
                      <div className="relative h-6 flex items-center group">
                        <div className="absolute w-full h-1.5 bg-green-900/50 rounded-full overflow-hidden">
                           <div className="h-full bg-purple-500 transition-all duration-75" style={{ width: `${decayScale}%` }} />
                        </div>
                        <input type="range" min="0" max="100" value={decayScale} onChange={handleDecayScaleChange} className="absolute w-full h-full opacity-0 cursor-pointer" />
                        <div className="absolute h-4 w-4 bg-black border-2 border-purple-500 rounded-full shadow-[0_0_5px_purple] pointer-events-none transform -translate-x-1/2 transition-all duration-75 group-active:scale-125" style={{ left: `${decayScale}%` }} />
                      </div>
                    </div>

                    {/* Pulse Frequency */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-green-600" />
                            <span className="text-xs font-bold text-green-500 uppercase">Pulse Frequency</span>
                        </div>
                        <span className="text-[10px] text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded">{range}%</span>
                      </div>
                      <div className="relative h-6 flex items-center group">
                        <div className="absolute w-full h-1.5 bg-green-900/50 rounded-full overflow-hidden">
                           <div className="h-full bg-yellow-500 transition-all duration-75" style={{ width: `${range}%` }} />
                        </div>
                        <input type="range" min="0" max="100" value={range} onChange={handleRangeChange} className="absolute w-full h-full opacity-0 cursor-pointer" />
                        <div className="absolute h-4 w-4 bg-black border-2 border-yellow-500 rounded-full shadow-[0_0_5px_yellow] pointer-events-none transform -translate-x-1/2 transition-all duration-75 group-active:scale-125" style={{ left: `${range}%` }} />
                      </div>
                    </div>

                    {/* Grid Density */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Grid className="w-4 h-4 text-green-600" />
                            <span className="text-xs font-bold text-green-500 uppercase">Grid Density</span>
                        </div>
                        <span className="text-[10px] text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded">{density}%</span>
                      </div>
                      <div className="relative h-6 flex items-center group">
                        <div className="absolute w-full h-1.5 bg-green-900/50 rounded-full overflow-hidden">
                           <div className="h-full bg-green-600 transition-all duration-75" style={{ width: `${density}%` }} />
                        </div>
                        <input type="range" min="0" max="100" value={density} onChange={handleDensityChange} className="absolute w-full h-full opacity-0 cursor-pointer" />
                        <div className="absolute h-4 w-4 bg-black border-2 border-green-500 rounded-full shadow-[0_0_5px_#0f0] pointer-events-none transform -translate-x-1/2 transition-all duration-75 group-active:scale-125" style={{ left: `${density}%` }} />
                      </div>
                    </div>

                  </div>
                </div>
             </div>
          </aside>
        </div>

        {/* Mobile Footer Status (Visible only on mobile) */}
        <div className="lg:hidden shrink-0 h-8 flex items-center px-2 border-t border-green-900/50 bg-black/60 backdrop-blur text-xs font-mono overflow-hidden whitespace-nowrap text-green-400/80">
            <span className="animate-pulse mr-2">_</span>
            {logs.length > 0 ? logs[logs.length - 1].message : "SYSTEM READY..."}
        </div>

        {/* Desktop Footer */}
        <footer className="hidden lg:flex text-[10px] text-green-900 justify-between uppercase tracking-wider shrink-0">
          <div>System Uptime: {Math.floor(performance.now() / 1000)}s</div>
          <div>Gemini Vision: Standby</div>
        </footer>

      </div>
    </div>
  );
};

export default App;