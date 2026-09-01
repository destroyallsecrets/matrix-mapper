import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const PORT = 3000;

const OFFLINE_TACTICAL_LOGS = [
  "Local heuristic complete. Structure: Ferro-concrete composite. Integrity: 94.2%.",
  "Bio-digital signature identified. Vector: Quadrant 2. Sector status: Monitored.",
  "Visual anomaly detected. Grid alignment corrected by 0.04%. Phase locked.",
  "Light spectrum analysis: Artificial fluorescence detected. Ambient lux nominal.",
  "Object geometry matches standard database primitives. No hostile deviations.",
  "Motion vectors static. Temporal ghosting suppressed. Signal integrity: 99.8%.",
  "Atmospheric density nominal. Depth buffer calibrated across 256 matrix strata.",
  "Surface signature scanned. Quantum entropy levels within permissible boundaries."
];

async function startServer() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // API Routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      system: 'Sight_OS', 
      version: 'v9.8.4-stable',
      timestamp: new Date().toISOString()
    });
  });

  app.post('/api/analyze', async (req, res) => {
    try {
      const { imageBase64, mode = 'tactical', customPrompt } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: 'Missing imageBase64 in request body' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        const randomLog = OFFLINE_TACTICAL_LOGS[Math.floor(Math.random() * OFFLINE_TACTICAL_LOGS.length)];
        return res.json({
          result: `[LOCAL_OVERRIDE] ${randomLog}`,
          source: 'local_heuristic',
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
        });
      }

      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const prompt = customPrompt || `
        You are the tactical AI HUD of a Matrix runner operating Sight_OS.
        Analyze this incoming video frame / spatial visual mapping.
        Identify primary objects, architectural structures, lighting anomalies, or biological signatures.
        Output format: Concise tactical assessment log in cyberpunk/terminal style.
        Provide actionable details (e.g., "TARGET: Humanoid silhouette [Q3] | AMBIENCE: High contrast | RECON: Sector stable").
        Length: 25-45 words maximum.
      `;

      // Try primary fast vision model with fallback for high-demand 503/429 spikes
      const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.7-flash'];
      let resultText: string | null = null;
      let usedModel: string = 'gemini-2.5-flash';

      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                { text: prompt }
              ]
            },
            config: {
              maxOutputTokens: 180,
              temperature: 0.6
            }
          });

          if (response?.text) {
            resultText = response.text;
            usedModel = modelName;
            break;
          }
        } catch (modelErr: any) {
          const isDemandSpike = modelErr?.status === 'UNAVAILABLE' || 
                                modelErr?.message?.includes('503') || 
                                modelErr?.message?.includes('429') ||
                                modelErr?.message?.includes('high demand');
          console.warn(`[Sight_OS AI] Model ${modelName} unavailable (${isDemandSpike ? 'Demand Spike' : modelErr?.message || 'Error'}). Trying next...`);
        }
      }

      if (!resultText) {
        const randomLog = OFFLINE_TACTICAL_LOGS[Math.floor(Math.random() * OFFLINE_TACTICAL_LOGS.length)];
        return res.json({
          result: `[LOCAL_OVERRIDE] ${randomLog}`,
          source: 'local_heuristic_fallback',
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
        });
      }

      return res.json({
        result: resultText,
        source: usedModel,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
      });

    } catch (err: any) {
      console.warn('[Sight_OS Vision Exception - Resilient Fallback]:', err?.message || err);
      const randomLog = OFFLINE_TACTICAL_LOGS[Math.floor(Math.random() * OFFLINE_TACTICAL_LOGS.length)];
      return res.json({
        result: `[LOCAL_OVERRIDE] ${randomLog}`,
        source: 'local_fallback',
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
      });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('{*path}', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Sight_OS Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[Sight_OS Server Startup Error]:', err);
});
