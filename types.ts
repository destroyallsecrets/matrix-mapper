export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'system' | 'analysis' | 'error' | 'input';
}

export enum MapMode {
  IDLE = 'IDLE',
  SCANNING = 'SCANNING',
  ANALYZING = 'ANALYZING',
}

export interface TacticalTelemetry {
  fps: number;
  activeResolution: string;
  gridCells: number;
  activeSource: 'camera' | 'file';
  sourceName: string;
  recordingDuration: number;
  crtScanlines: boolean;
  soundEnabled: boolean;
}
