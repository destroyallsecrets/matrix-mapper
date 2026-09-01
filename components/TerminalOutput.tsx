import React, { useEffect, useRef, useState } from 'react';
import { LogEntry } from '../types';
import { X, Copy, Trash2, ArrowDownCircle, Check, Terminal as TerminalIcon, Send, Sparkles } from 'lucide-react';

interface TerminalOutputProps {
  logs: LogEntry[];
  onClose?: () => void;
  onClearLogs?: () => void;
  onExecuteCommand?: (cmd: string) => void;
}

const TerminalOutput: React.FC<TerminalOutputProps> = ({ 
  logs, 
  onClose,
  onClearLogs,
  onExecuteCommand
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<'all' | 'analysis' | 'system' | 'input' | 'error'>('all');
  const [inputVal, setInputVal] = useState('');
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    return log.type === filter;
  });

  const handleCopy = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    onExecuteCommand?.(inputVal.trim());
    setInputVal('');
  };

  return (
    <div className="flex flex-col h-full border border-green-900/60 bg-black/95 rounded-lg shadow-[0_0_20px_rgba(0,255,0,0.08)] font-mono text-xs overflow-hidden backdrop-blur-md">
      {/* Header bar */}
      <div className="bg-green-950/30 px-3 py-2 border-b border-green-900/40 flex justify-between items-center select-none shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-green-500" />
          <span className="text-green-400 font-bold tracking-widest text-[11px]">DIAGNOSTIC_CONSOLE</span>
          <span className="text-[9px] text-green-700 font-bold px-1.5 py-0.5 rounded bg-green-950/60 border border-green-900/50 animate-pulse">
            ● SYNC
          </span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-green-900/30 text-green-700 hover:text-green-400 rounded transition-colors"
            title="Copy Logs to Clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          
          {onClearLogs && (
            <button
              onClick={onClearLogs}
              className="p-1 hover:bg-green-900/30 text-green-700 hover:text-red-400 rounded transition-colors"
              title="Clear Logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1 rounded transition-colors ${autoScroll ? 'text-green-500 bg-green-950/40' : 'text-green-900 hover:text-green-600'}`}
            title={autoScroll ? 'Auto-scroll Enabled' : 'Auto-scroll Disabled'}
          >
            <ArrowDownCircle className="w-3.5 h-3.5" />
          </button>

          {onClose && (
            <button 
              onClick={onClose}
              className="text-green-800 hover:text-green-400 transition-colors p-1 ml-1"
              aria-label="Hide logs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-black/60 border-b border-green-900/20 text-[9px] uppercase tracking-wider overflow-x-auto custom-scrollbar shrink-0">
        {(['all', 'analysis', 'system', 'input', 'error'] as const).map((cat) => {
          const count = cat === 'all' ? logs.length : logs.filter(l => l.type === cat).length;
          const isActive = filter === cat;
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-2 py-0.5 rounded transition-all whitespace-nowrap flex items-center gap-1 ${
                isActive 
                  ? 'bg-green-900/40 text-green-300 border border-green-700/50 font-bold' 
                  : 'text-green-900 hover:text-green-600 border border-transparent'
              }`}
            >
              {cat === 'analysis' ? 'Tactical/AI' : cat}
              <span className={`text-[8px] px-1 rounded ${isActive ? 'bg-green-700/40 text-green-200' : 'bg-green-950/30 text-green-800'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Log Feed */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto p-3 space-y-1.5 font-mono text-[11px] leading-relaxed custom-scrollbar selection:bg-green-800 selection:text-white"
      >
        {filteredLogs.map((log) => {
          let badgeColor = 'text-green-500';
          let prefix = '>';
          let bgColor = 'hover:bg-green-950/10';

          if (log.type === 'error') {
            badgeColor = 'text-red-400 bg-red-950/20 border-red-900/40';
            prefix = 'ERR:';
            bgColor = 'bg-red-950/10 hover:bg-red-950/20';
          } else if (log.type === 'analysis') {
            badgeColor = 'text-cyan-300 bg-cyan-950/20 border-cyan-900/40';
            prefix = 'AI:';
            bgColor = 'bg-cyan-950/10 hover:bg-cyan-950/20';
          } else if (log.type === 'input') {
            badgeColor = 'text-yellow-400 bg-yellow-950/20 border-yellow-900/40';
            prefix = '$';
          }

          return (
            <div key={log.id} className={`flex items-start gap-1.5 p-1 rounded transition-colors ${bgColor}`}>
              <span className="text-green-900 select-none text-[9px] shrink-0 pt-0.5">
                [{log.timestamp}]
              </span>
              <span className={`text-[9px] font-bold px-1 rounded border uppercase select-none shrink-0 ${badgeColor}`}>
                {prefix}
              </span>
              <span className={`break-words flex-1 ${
                log.type === 'error' ? 'text-red-400 font-medium' :
                log.type === 'analysis' ? 'text-cyan-300' :
                log.type === 'input' ? 'text-yellow-300' :
                'text-green-400/90'
              }`}>
                {log.message}
              </span>
            </div>
          );
        })}
        {filteredLogs.length === 0 && (
          <div className="text-green-900/60 italic text-center py-6 select-none text-[10px]">
            No records in current telemetry buffer...
          </div>
        )}
      </div>

      {/* Interactive Command Prompt */}
      {onExecuteCommand && (
        <form onSubmit={handleSubmit} className="border-t border-green-900/40 bg-green-950/10 p-2 flex items-center gap-2 shrink-0">
          <span className="text-green-600 font-bold text-[10px] select-none shrink-0">root@sight_os:~$</span>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Type 'help', 'scan', 'snap', 'rec', 'color'..."
            className="flex-1 bg-black/60 border border-green-900/40 rounded px-2 py-1 text-green-300 text-[11px] placeholder:text-green-900/70 focus:outline-none focus:border-green-500 font-mono"
          />
          <button
            type="submit"
            className="px-2 py-1 bg-green-900/40 hover:bg-green-700/50 border border-green-800 text-green-300 rounded text-[10px] font-bold uppercase transition-all"
          >
            <Send className="w-3 h-3" />
          </button>
        </form>
      )}
    </div>
  );
};

export default TerminalOutput;
