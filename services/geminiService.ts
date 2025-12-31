
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeAudio = async (audioBlob: Blob) => {
  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve) => {
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.readAsDataURL(audioBlob);
  });

  const base64Data = await base64Promise;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: 'audio/mp3',
              data: base64Data
            }
          },
          {
            text: "Please provide a detailed summary of this audio content, a transcript (or summary of dialogue if music/abstract), and list 3 key moments with timestamps."
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          transcript: { type: Type.STRING },
          keyMoments: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                time: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["time", "description"]
            }
          }
        },
        required: ["summary", "transcript", "keyMoments"]
      }
    }
  });

  return JSON.parse(response.text);
};
