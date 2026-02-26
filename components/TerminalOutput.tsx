
import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import { X } from 'lucide-react';

interface TerminalOutputProps {
  logs: LogEntry[];
  onClose?: () => void;
}

const TerminalOutput: React.FC<TerminalOutputProps> = ({ logs, onClose }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full border border-green-900 bg-black/90 rounded-lg shadow-[0_0_15px_rgba(0,255,0,0.1)] font-mono text-sm overflow-hidden">
      <div className="bg-green-900/20 p-2 border-b border-green-900 flex justify-between items-center select-none">
        <div className="flex items-center gap-2">
            <span className="text-green-500 font-bold">SYSTEM_LOGS</span>
            <span className="text-xs text-green-700 animate-pulse">● LIVE</span>
        </div>
        {onClose && (
            <button 
                onClick={onClose}
                className="text-green-800 hover:text-green-500 transition-colors p-1"
                aria-label="Hide logs"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        )}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2">
            <span className="text-gray-500 shrink-0">[{log.timestamp}]</span>
            <span className={`${
              log.type === 'error' ? 'text-red-500' :
              log.type === 'analysis' ? 'text-cyan-400' :
              log.type === 'input' ? 'text-yellow-400' :
              'text-green-400'
            }`}>
              {log.type === 'system' && '> '}
              {log.type === 'input' && '$ '}
              {log.type === 'analysis' && '>> '}
              {log.message}
            </span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-gray-700 italic">No activity detected...</div>
        )}
      </div>
    </div>
  );
};

export default TerminalOutput;
