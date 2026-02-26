import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const OFFLINE_ANALYSIS_LOGS = [
  "Local heuristic complete. Structure: Ferro-concrete composite. Integrity: 94%.",
  "Bio-digital signature not found. Sector clear.",
  "Visual anomaly detected. Grid alignment corrected by 0.04%.",
  "Light spectrum analysis: Artificial fluorescence detected.",
  "Object geometry matches standard database primitives.",
  "Motion vectors static. No hostile agents tracked.",
  "Atmospheric density nominal. Sensors calibrated.",
  "Decryption failed. Surface patterns contain no hidden glyphs."
];

export const analyzeSector = async (
  imageBase64: string
): Promise<string> => {
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  const prompt = `
    You are the tactical AI of a Matrix runner. 
    Analyze the incoming video feed (spatial mapping).
    Identify objects, people, or threats in the visual field.
    Provide a tactical assessment log. 
    Style: Cyberpunk, machine-code style, cryptic but informative.
    Max 40 words.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          { text: prompt }
        ]
      },
      config: {
        maxOutputTokens: 150,
        temperature: 0.7
      }
    });
    
    return response.text || "Visual analysis inconclusive. Signal lost.";
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    const randomLog = OFFLINE_ANALYSIS_LOGS[Math.floor(Math.random() * OFFLINE_ANALYSIS_LOGS.length)];
    return `[LOCAL_OVERRIDE] ${randomLog}`;
  }
};