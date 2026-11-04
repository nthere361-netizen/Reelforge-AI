export const domainGuidanceMap: Record<string, string> = {
  agriculture:
    'Use plain farmer-friendly language. Mention crop, season, growth stage and units exactly as in the source. Never add dosages, chemical names or quantities not present in the source. Set advisory_note to a one-line reminder to confirm region-specific advice with a local agricultural extension officer.',
  education: 'Teach with one idea per scene, use analogies, end with a one-line recap.',
  marketing:
    'Lead with the audience problem, show the benefit, make the call to action concrete. No unverifiable superlatives.',
  technology: 'Be precise, define terms once, show a tiny example when possible.',
  health:
    'Informational tone only, no diagnosis or treatment promises, set advisory_note to recommend consulting a qualified professional.',
  finance:
    'Educational only, no investment advice or guaranteed returns, set advisory_note to state this is not financial advice.',
  travel: 'Sensory and vivid, include practical tips present in the source.',
  news: 'Neutral, attribute claims to the source, no opinion.',
  general: 'Clear, neutral and engaging.',
};

