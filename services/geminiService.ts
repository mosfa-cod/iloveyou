
import { GoogleGenAI, Type, Modality } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const handleApiError = (error: any) => {
  console.error("API Error Details:", error);
  if (error?.message?.toLowerCase().includes("quota") || error?.status === 429) {
    throw new Error("QUOTA_EXCEEDED");
  }
  throw error;
};

export const translateAndExplain = async (query: string): Promise<any> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a friendly, expert teacher for kids aged 8-14. 
      Translate the word/phrase: "${query}". 
      Respond ONLY with a JSON object containing:
      - original (the input word)
      - translation (Arabic translation)
      - partOfSpeech (Noun, Verb, etc.)
      - exampleAr (A simple Arabic sentence with the word, using Harakat)
      - exampleEn (A simple English sentence with the word)
      - definition (A very simple explanation for a child)`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            original: { type: Type.STRING },
            translation: { type: Type.STRING },
            partOfSpeech: { type: Type.STRING },
            exampleAr: { type: Type.STRING },
            exampleEn: { type: Type.STRING },
            definition: { type: Type.STRING },
          },
          required: ["original", "translation", "partOfSpeech", "exampleAr", "exampleEn", "definition"],
        },
      },
    });
    return JSON.parse(response.text);
  } catch (error) { return handleApiError(error); }
};

export const getMotivationalQuote = async (): Promise<string> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'أعطني حكمة عربية قصيرة جداً ومبهجة للأطفال عن العلم بلسان الأستاذ مصطفى دحروج (بأسلوب الجد الحكيم).',
    });
    return response.text?.trim() || "العلم نور يضيء دروبكم يا أبطال.";
  } catch { return "العلم هو سلاحكم للنجاح يا أحفادي."; }
};

export const generateIllustration = async (word: string): Promise<string | undefined> => {
  try {
    const ai = getAI();
    // تم تعديل البرومبت هنا لمنع كتابة النصوص تماماً
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `A vibrant, friendly 3D cartoon illustration for children representing the word: "${word}". Pixar style, soft lighting, cheerful atmosphere. IMPORTANT: NO TEXT, NO LETTERS, NO WORDS, NO WRITING AT ALL IN THE IMAGE. Just a clean visual drawing without any language or characters.` }]
      },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  } catch { return undefined; }
};

export const generateSpeech = async (text: string, isArabic: boolean): Promise<Uint8Array | undefined> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: isArabic ? 'Kore' : 'Puck' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
  } catch { return undefined; }
};

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
