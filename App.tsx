
import React, { useState, useEffect } from 'react';
import RealityMapper from './components/RealityMapper';

const App: React.FC = () => {
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');

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

  useEffect(() => {
    refreshDevices();
    
    const handleDeviceChange = () => refreshDevices();
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, []);

  return (
    <div className="w-full h-[100dvh] overflow-hidden bg-black">
      <div className="absolute top-2 left-2 z-50">
        <select 
          value={selectedCamera} 
          onChange={(e) => setSelectedCamera(e.target.value)}
          className="bg-black border border-green-800 text-green-500 text-xs px-2 py-1 rounded"
        >
          {videoDevices.length === 0 && <option value="">Loading...</option>}
          {videoDevices.map((device, idx) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${idx + 1}`}
            </option>
          ))}
        </select>
      </div>
      
      <RealityMapper 
        selectedDeviceId={selectedCamera}
        onStreamActive={() => refreshDevices()}
      />
    </div>
  );
};

export default App;
