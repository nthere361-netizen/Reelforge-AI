import { AppError } from './errors.js';

export function pcmToWav(pcm: Buffer, rate = 24000, channels = 1, bits = 16): Buffer {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // AudioFormat PCM = 1
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE((rate * channels * bits) / 8, 28); // ByteRate
  h.writeUInt16LE((channels * bits) / 8, 32); // BlockAlign
  h.writeUInt16LE(bits, 34); // BitsPerSample
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export function extractPcmFromWav(wavBuffer: Buffer): Buffer {
  if (wavBuffer.length < 44) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid WAV buffer length');
  }
  const riff = wavBuffer.toString('utf-8', 0, 4);
  const wave = wavBuffer.toString('utf-8', 8, 12);
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid RIFF/WAVE header');
  }
  return wavBuffer.subarray(44);
}

export function concatenateWavFiles(wavBuffers: Buffer[], silenceMs = 250, sampleRate = 24000): {
  buffer: Buffer;
  durationMs: number;
} {
  if (wavBuffers.length === 0) {
    throw new AppError('VALIDATION_ERROR', 400, 'No audio buffers to concatenate');
  }

  // 24kHz 16-bit mono = 48,000 bytes per second = 48 bytes per ms
  const bytesPerMs = (sampleRate * 1 * 16) / 8 / 1000;
  const silenceBytes = Math.round(silenceMs * bytesPerMs);
  const silenceBuffer = Buffer.alloc(silenceBytes, 0);

  const pcmChunks: Buffer[] = [];
  for (let i = 0; i < wavBuffers.length; i++) {
    const pcm = extractPcmFromWav(wavBuffers[i]);
    pcmChunks.push(pcm);
    if (i < wavBuffers.length - 1 && silenceBytes > 0) {
      pcmChunks.push(silenceBuffer);
    }
  }

  const totalPcm = Buffer.concat(pcmChunks);
  const totalDurationMs = Math.round(totalPcm.length / bytesPerMs);
  const wav = pcmToWav(totalPcm, sampleRate, 1, 16);

  return { buffer: wav, durationMs: totalDurationMs };
}

