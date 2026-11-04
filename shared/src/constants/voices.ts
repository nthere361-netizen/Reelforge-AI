export const VOICE_NAMES = [
  'Kore',
  'Puck',
  'Charon',
  'Zephyr',
  'Fenrir',
  'Aoede',
  'Leda',
  'Orus',
] as const;

export type VoiceName = (typeof VOICE_NAMES)[number];

export interface VoiceMeta {
  name: VoiceName;
  gender: 'female' | 'male';
  description: string;
}

export const VOICES: Record<VoiceName, VoiceMeta> = {
  Kore: { name: 'Kore', gender: 'female', description: 'Warm, clear, balanced narrator voice' },
  Puck: { name: 'Puck', gender: 'male', description: 'Playful, lively and engaging youthful voice' },
  Charon: { name: 'Charon', gender: 'male', description: 'Deep, resonant, authoritative documentary voice' },
  Zephyr: { name: 'Zephyr', gender: 'female', description: 'Breezy, crisp, friendly modern voice' },
  Fenrir: { name: 'Fenrir', gender: 'male', description: 'Strong, energetic, dynamic commercial voice' },
  Aoede: { name: 'Aoede', gender: 'female', description: 'Expressive, storytelling, melodious voice' },
  Leda: { name: 'Leda', gender: 'female', description: 'Calm, gentle, reassuring educational voice' },
  Orus: { name: 'Orus', gender: 'male', description: 'Steady, professional, corporate presenter voice' },
};

