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
