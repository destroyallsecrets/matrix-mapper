import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const analyzeSector = async (
  imageBase64: string
): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key not found. Neural uplink severed.");
  }

  // Remove data:image/jpeg;base64, prefix if present for the API call
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  const prompt = `
    You are the tactical AI of a Matrix runner. 
    Analyze the incoming video feed (spacial mapping).
    Identify objects, people, or threats in the visual field.
    Provide a tactical assessment log. 
    Style: Cyberpunk, machine-code style, cryptic but informative.
    Max 60 words.
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
        temperature: 0.6,
      }
    });
    
    return response.text || "Visual analysis inconclusive. Signal lost.";
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    throw new Error("Visual processing unit offline. Connection reset.");
  }
};