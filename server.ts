import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";
import path from "path";

function handleGeminiError(error: any): { status: number, message: string } {
  const errorString = error?.message || String(error);
  
  if (errorString.includes("API key not valid") || errorString.includes("API_KEY_INVALID")) {
    return { status: 401, message: "Invalid API key. Please check your GEMINI_API_KEY in the Settings menu." };
  }
  if (errorString.includes("Quota exceeded") || errorString.includes("429") || errorString.includes("Too Many Requests")) {
    return { status: 429, message: "Rate limit exceeded. Please wait a moment and try again." };
  }
  if (errorString.includes("mimeType") || errorString.includes("unsupported") || errorString.includes("invalid argument")) {
    return { status: 400, message: "Unsupported file type or content. Please ensure you uploaded a valid PDF." };
  }
  if (errorString.includes("fetch failed") || errorString.includes("network")) {
    return { status: 503, message: "Network error connecting to the AI service. Please try again." };
  }
  
  return { status: 500, message: errorString || "An unexpected error occurred during processing." };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for PDF uploads
  app.use(express.json({ limit: '50mb' }));

  app.post("/api/extract-text", async (req, res) => {
    try {
      const { pdfBase64 } = req.body;
      if (!pdfBase64) {
        return res.status(400).json({ error: "No PDF provided" });
      }

      console.log("Extract text - API Key length:", process.env.GEMINI_API_KEY?.length);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const textResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: [
              { text: "Extract the main text from this document, suitable for narration. Exclude page numbers, headers, footers, and complex tables. Just provide the clean text to be read aloud." },
              { inlineData: { data: pdfBase64, mimeType: "application/pdf" } }
            ]
          }
        ]
      });

      const extractedText = textResponse.text;
      if (!extractedText) throw new Error("Failed to extract text from PDF");

      res.json({ text: extractedText });
    } catch (error: any) {
      console.error("Backend text extraction error:", error);
      const { status, message } = handleGeminiError(error);
      res.status(status).json({ error: message });
    }
  });

  app.post("/api/generate-audio", async (req, res) => {
    try {
      const { text, voice } = req.body;
      if (!text) {
        return res.status(400).json({ error: "No text provided" });
      }

      const voiceName = voice || 'Kore';
      console.log("Generate audio - API Key length:", process.env.GEMINI_API_KEY?.length);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const audioResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
          },
        },
      });

      const base64Audio = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("Failed to generate audio");

      res.json({ audioBase64: base64Audio });
    } catch (error: any) {
      console.error("Backend audio generation error:", error);
      const { status, message } = handleGeminiError(error);
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
