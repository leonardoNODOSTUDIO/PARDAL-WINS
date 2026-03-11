import { GoogleGenAI } from "@google/genai";

export async function generateAppIcon() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: {
      parts: [
        {
          text: "Professional mobile app icon for a casual game called 'PARDAL WINS'. A friendly and expressive cartoon sparrow with natural colors (brown, beige, white), large expressive eyes, and a small yellow beak. The sparrow looks confident, determined, and fun. Pose: head slightly tilted, wings slightly open, dynamic flying position. Modern cartoon style, clean lines, minimalist design. Background: simple soft gradient from sky blue to turquoise. Composition: sparrow centered, occupying most of the space, no text, no extra elements. Square icon with rounded corners, high resolution, sharp and recognizable.",
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
        imageSize: "1K"
      },
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
}
