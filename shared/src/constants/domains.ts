export const DOMAIN_KEYS = [
  'agriculture',
  'education',
  'marketing',
  'technology',
  'health',
  'finance',
  'travel',
  'news',
  'general',
] as const;

export type DomainKey = (typeof DOMAIN_KEYS)[number];

export interface DomainMeta {
  key: DomainKey;
  label: string;
  typicalSources: string;
  defaultVisualStyle: string;
}

export const DOMAINS: Record<DomainKey, DomainMeta> = {
  agriculture: {
    key: 'agriculture',
    label: 'Agriculture and Crop Advisory',
    typicalSources: 'Farming guides, crop care articles, pest and soil advisories, weather notices',
    defaultVisualStyle: 'photorealistic',
  },
  education: {
    key: 'education',
    label: 'Education and Learning',
    typicalSources: 'Lecture notes, study guides, explainers',
    defaultVisualStyle: 'flat_illustration',
  },
  marketing: {
    key: 'marketing',
    label: 'Marketing and Product',
    typicalSources: 'Product blogs, case studies, press releases',
    defaultVisualStyle: 'cinematic',
  },
  technology: {
    key: 'technology',
    label: 'Technology and Software',
    typicalSources: 'Tech articles, documentation, release notes',
    defaultVisualStyle: 'cinematic',
  },
  health: {
    key: 'health',
    label: 'Health and Wellness',
    typicalSources: 'Wellness articles, fitness guides',
    defaultVisualStyle: 'photorealistic',
  },
  finance: {
    key: 'finance',
    label: 'Finance and Business',
    typicalSources: 'Market explainers, business blogs',
    defaultVisualStyle: 'minimal_infographic',
  },
  travel: {
    key: 'travel',
    label: 'Travel and Lifestyle',
    typicalSources: 'Destination blogs, guides',
    defaultVisualStyle: 'cinematic',
  },
  news: {
    key: 'news',
    label: 'News and Explainers',
    typicalSources: 'News articles, policy summaries',
    defaultVisualStyle: 'cinematic',
  },
  general: {
    key: 'general',
    label: 'General Knowledge',
    typicalSources: 'Anything else',
    defaultVisualStyle: 'cinematic',
  },
};

