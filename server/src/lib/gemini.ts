import { GoogleGenAI } from '@google/genai';
import { z, ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { env } from '../config/env.js';
import { logger } from './logger.js';
import { AppError } from './errors.js';
import { pcmToWav } from './wav.js';

export const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

async function withRetry<T>(fn: () => Promise<T>, attempts = 2, timeoutMs = 25000): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new AppError('AI_UPSTREAM_ERROR', 504, 'AI upstream request timed out')), timeoutMs)
      );
      return await Promise.race([fn(), timeoutPromise]);
    } catch (err: any) {
      last = err;
      const status = err?.status ?? err?.code;
      if (![429, 500, 503, 504].includes(Number(status))) break;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw last;
}

function safeParse<S extends ZodTypeAny>(schema: S, text: string | undefined) {
  try {
    const raw = JSON.parse(text ?? '');
    const r = schema.safeParse(raw);
    return r.success
      ? { success: true as const, data: r.data as z.infer<S> }
      : { success: false as const, issues: r.error.issues };
  } catch {
    return { success: false as const, issues: [{ message: 'Response was not valid JSON' }] };
  }
}

export async function generateStructured<S extends ZodTypeAny>(opts: {
  schema: S;
  systemInstruction: string;
  prompt: string;
  temperature?: number;
}): Promise<z.infer<S>> {
  // Generate JSON Schema from Zod
  const jsonSchema = zodToJsonSchema(opts.schema, { target: 'openAi' });
  delete (jsonSchema as any)['$schema'];

  const candidateModels = [
    env.GEMINI_TEXT_MODEL,
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
  ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

  const callWithModel = (prompt: string, model: string) =>
    withRetry(() =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: opts.systemInstruction,
          responseMimeType: 'application/json',
          responseJsonSchema: jsonSchema as any,
          temperature: opts.temperature ?? 0.7,
          maxOutputTokens: 8192,
        },
      })
    );

  let res: any;
  let lastErr: any;
  for (const model of candidateModels) {
    try {
      res = await callWithModel(opts.prompt, model);
      if (res?.text) {
        break;
      }
    } catch (err: any) {
      lastErr = err;
      logger.warn({ model, err: err?.message || err }, 'Gemini model attempt failed, trying fallback');
    }
  }

  if (!res?.text) {
    logger.error({ err: lastErr }, 'All Gemini text candidate models failed');
    throw new AppError('AI_UPSTREAM_ERROR', 502, 'Failed to communicate with AI provider');
  }

  let parsed = safeParse(opts.schema, res.text);
  if (!parsed.success) {
    logger.warn({ issues: parsed.issues }, 'AI output invalid, attempting repair retry');
    const repair = `${opts.prompt}\n\nYour previous reply failed validation with these issues: ${JSON.stringify(
      parsed.issues
    ).slice(0, 1500)}. Return corrected JSON only, matching the schema exactly.`;
    try {
      res = await callWithModel(repair, candidateModels[0]);
    } catch (err: any) {
      logger.error({ err }, 'Gemini repair call failed');
      throw new AppError('AI_UPSTREAM_ERROR', 502, 'AI repair retry request failed');
    }
    parsed = safeParse(opts.schema, res.text);
    if (!parsed.success) {
      logger.error({ issues: parsed.issues }, 'AI output repair failed validation');
      throw new AppError(
        'AI_OUTPUT_INVALID',
        502,
        'The AI returned an invalid response after repair. Please retry.'
      );
    }
  }

  return parsed.data;
}

// Speech: Gemini returns 24 kHz, 16-bit, mono PCM as base64. Wrap it as WAV.
export async function synthesizeSpeech(text: string, voice: string, toneDirective: string) {
  try {
    const res = await withRetry(() =>
      ai.models.generateContent({
        model: env.GEMINI_TTS_MODEL,
        contents: [{ parts: [{ text: `${toneDirective}: ${text}` }] }] as any,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        } as any,
      })
    );
    const b64 = res.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data)?.inlineData?.data;
    if (!b64) throw new AppError('AI_UPSTREAM_ERROR', 502, 'No audio returned from speech model');
    const pcm = Buffer.from(b64, 'base64');
    return {
      wav: pcmToWav(pcm, 24000, 1, 16),
      durationMs: Math.round((pcm.length / (24000 * 2)) * 1000),
    };
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    logger.error({ err }, 'Gemini speech synthesis failed');
    throw new AppError('AI_UPSTREAM_ERROR', 502, 'Failed to synthesize speech audio');
  }
}

// Images: returns image bytes and MIME type
export async function generateImage(prompt: string, aspectRatio: '9:16' | '16:9' | '1:1') {
  try {
    const res = await withRetry(() =>
      ai.models.generateContent({
        model: env.GEMINI_IMAGE_MODEL,
        contents: prompt,
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio },
        } as any,
      })
    );
    const part = res.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);
    if (!part?.inlineData?.data) {
      throw new AppError('AI_UPSTREAM_ERROR', 502, 'No image returned from image model');
    }
    const bytes = Buffer.from(part.inlineData.data, 'base64');
    const mimeType = part.inlineData.mimeType ?? 'image/png';

    // Verify magic bytes (PNG: 89 50 4E 47 or JPEG: FF D8 FF)
    const isPng = bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isJpg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!isPng && !isJpg) {
      throw new AppError('AI_UPSTREAM_ERROR', 502, 'Generated image signature verification failed');
    }

    return { bytes, mimeType };
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    logger.error({ err }, 'Gemini image generation failed');
    throw new AppError('AI_UPSTREAM_ERROR', 502, 'Failed to generate scene visual image');
  }
}

