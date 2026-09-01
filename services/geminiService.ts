const OFFLINE_ANALYSIS_LOGS = [
  "Local heuristic complete. Structure: Ferro-concrete composite. Integrity: 94%.",
  "Bio-digital signature identified. Sector status: Monitored.",
  "Visual anomaly detected. Grid alignment corrected by 0.04%.",
  "Light spectrum analysis: Artificial fluorescence detected.",
  "Object geometry matches standard database primitives.",
  "Motion vectors static. No hostile agents tracked.",
  "Atmospheric density nominal. Sensors calibrated.",
  "Decryption complete. Spatial strata locked."
];

export const analyzeSector = async (
  imageBase64: string,
  customPrompt?: string
): Promise<string> => {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageBase64,
        customPrompt
      })
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    return data.result || "Visual analysis completed.";
  } catch (error) {
    console.error("Tactical Vision Analysis Error:", error);
    const randomLog = OFFLINE_ANALYSIS_LOGS[Math.floor(Math.random() * OFFLINE_ANALYSIS_LOGS.length)];
    return `[LOCAL_OVERRIDE] ${randomLog}`;
  }
};