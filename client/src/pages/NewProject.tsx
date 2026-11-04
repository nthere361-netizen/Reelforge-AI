import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  DOMAIN_KEYS,
  DOMAINS,
  DomainKey,
  TARGET_PLATFORMS,
  PLATFORM_ASPECT_RATIOS,
  TargetPlatform,
  ASPECT_RATIOS,
  TONES,
  LANGUAGES,
  LANGUAGE_LABELS,
  Language,
  VOICE_NAMES,
  VOICES,
  VoiceName,
  VISUAL_STYLES,
  VisualStyle,
  ExpandIdeaResponse,
  DocumentTopicsResponse,
} from '@reelforge/shared';
import { apiRequest } from '../lib/apiClient';
import {
  FileText,
  Upload,
  Globe,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Lightbulb,
  BookOpen,
  Layers,
  Wand2,
} from 'lucide-react';

const CreateProjectFormSchema = z
  .object({
    title: z.string().min(3, 'Title must be at least 3 characters').max(120),
    domain: z.enum(DOMAIN_KEYS as any),
    target_platform: z.enum(TARGET_PLATFORMS as any),
    aspect_ratio: z.enum(ASPECT_RATIOS as any),
    target_duration_seconds: z.coerce.number().int().min(15).max(180),
    tone: z.enum(TONES as any),
    language: z.enum(LANGUAGES as any),
    audience: z.string().max(200).default(''),
    voice_name: z.enum(VOICE_NAMES as any),
    visual_style: z.enum(VISUAL_STYLES as any),
    include_cta: z.boolean().default(true),
    extra_instructions: z.string().max(500).default(''),
    source_text: z.string().min(200, 'Source text must contain at least 200 characters').max(60000),
  })
  .superRefine((data, ctx) => {
    const shorts = ['youtube_shorts', 'tiktok', 'instagram_reels'];
    if (shorts.includes(data.target_platform) && data.target_duration_seconds > 90) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${data.target_platform} duration cannot exceed 90 seconds.`,
        path: ['target_duration_seconds'],
      });
    }
  });

type FormValues = z.infer<typeof CreateProjectFormSchema>;

export const NewProject: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'idea' | 'file' | 'paste' | 'url'>('idea');
  const [ideaInput, setIdeaInput] = useState('');
  const [isExpandingIdea, setIsExpandingIdea] = useState(false);
  const [ideaBlueprint, setIdeaBlueprint] = useState<ExpandIdeaResponse | null>(null);

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractSuccess, setExtractSuccess] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [sourceFilename, setSourceFilename] = useState<string | undefined>(undefined);
  const [sourceUrl, setSourceUrl] = useState<string | undefined>(undefined);
  const [documentTopics, setDocumentTopics] = useState<DocumentTopicsResponse | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string>('all');
  const [rawExtractedText, setRawExtractedText] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(CreateProjectFormSchema),
    defaultValues: {
      title: '',
      domain: 'general',
      target_platform: 'youtube_shorts',
      aspect_ratio: '9:16',
      target_duration_seconds: 45,
      tone: 'informative',
      language: 'en',
      audience: '',
      voice_name: 'Kore',
      visual_style: 'cinematic',
      include_cta: true,
      extra_instructions: '',
      source_text: '',
    },
  });

  const sourceText = watch('source_text') || '';
  const selectedPlatform = watch('target_platform');
  const selectedDomain = watch('domain');
  const currentDuration = watch('target_duration_seconds');

  // Handle platform change -> update aspect ratio
  const handlePlatformChange = (platform: TargetPlatform) => {
    setValue('target_platform', platform);
    setValue('aspect_ratio', PLATFORM_ASPECT_RATIOS[platform]);
    const shorts = ['youtube_shorts', 'tiktok', 'instagram_reels'];
    if (shorts.includes(platform) && currentDuration > 90) {
      setValue('target_duration_seconds', 45);
    }
  };

  // Handle domain change -> update default visual style
  const handleDomainChange = (dom: DomainKey) => {
    setValue('domain', dom);
    const meta = DOMAINS[dom];
    if (meta?.defaultVisualStyle) {
      setValue('visual_style', meta.defaultVisualStyle as VisualStyle);
    }
  };

  // Handle Idea Expansion
  const handleExpandIdea = async () => {
    if (!ideaInput.trim() || ideaInput.trim().length < 5) return;
    setIsExpandingIdea(true);
    setExtractError(null);
    setExtractSuccess(null);

    try {
      const res = await apiRequest<ExpandIdeaResponse>('/sources/expand-idea', {
        method: 'POST',
        body: JSON.stringify({
          topic: ideaInput.trim(),
          domain: watch('domain') || 'general',
          target_platform: watch('target_platform') || 'youtube_shorts',
        }),
      });

      setIdeaBlueprint(res);
      setValue('title', res.title, { shouldValidate: true });
      setValue('domain', res.domain as DomainKey, { shouldValidate: true });
      setValue('target_platform', res.target_platform as TargetPlatform, { shouldValidate: true });
      setValue('aspect_ratio', res.aspect_ratio as any, { shouldValidate: true });
      setValue('target_duration_seconds', res.target_duration_seconds, { shouldValidate: true });
      setValue('tone', res.tone as any, { shouldValidate: true });
      setValue('visual_style', res.visual_style as VisualStyle, { shouldValidate: true });
      setValue('audience', res.audience || '', { shouldValidate: true });
      setValue('source_text', res.expanded_source_text, { shouldValidate: true });

      setExtractSuccess(`AI generated structured blueprint "${res.title}" with engaging hook and source script.`);
    } catch (err: any) {
      setExtractError(err.message || 'Failed to expand idea into video blueprint');
    } finally {
      setIsExpandingIdea(false);
    }
  };

  // Handle file extraction with automatic document topic breakdown
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtractError(null);
    setExtractSuccess(null);
    setExtracting(true);
    setDocumentTopics(null);
    setSelectedTopicId('all');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiRequest<{
        text: string;
        word_count: number;
        truncated: boolean;
        filename: string;
      }>('/sources/extract', {
        method: 'POST',
        body: formData,
      });

      setRawExtractedText(res.text);
      setValue('source_text', res.text, { shouldValidate: true });
      setSourceFilename(res.filename);
      setSourceUrl(undefined);
      if (!watch('title')) {
        setValue('title', file.name.replace(/\.[^/.]+$/, '').slice(0, 100));
      }

      setExtractSuccess(
        `Successfully extracted ${res.word_count} words from ${res.filename}${
          res.truncated ? ' (truncated to 60,000 chars)' : ''
        }`
      );

      // Now auto-extract document topics for explainer selection
      try {
        const topicsRes = await apiRequest<DocumentTopicsResponse>('/sources/document-topics', {
          method: 'POST',
          body: JSON.stringify({
            document_text: res.text,
            filename: res.filename,
          }),
        });
        setDocumentTopics(topicsRes);
      } catch (topicErr) {
        // Topic extraction failure is non-fatal; the raw document is already in source_text
        console.warn('Document topic extraction note:', topicErr);
      }
    } catch (err: any) {
      setExtractError(err.message || 'Failed to extract text from uploaded document');
    } finally {
      setExtracting(false);
    }
  };

  const handleSelectTopic = (topicId: string) => {
    setSelectedTopicId(topicId);
    if (!documentTopics) return;

    if (topicId === 'all') {
      setValue('source_text', rawExtractedText, { shouldValidate: true });
      return;
    }

    const found = documentTopics.topics.find((t) => t.id === topicId);
    if (found) {
      const topicSourceText = `## Document Section: ${found.title}\n\nSummary:\n${found.summary}\n\nCore Educational Concepts:\n${found.key_concepts.map((c) => `- ${c}`).join('\n')}\n\nReference Material from ${sourceFilename || 'Document'}:\n${rawExtractedText.slice(0, 1500)}`;
      setValue('source_text', topicSourceText, { shouldValidate: true });
      setValue('title', `${found.title} - Explainer`, { shouldValidate: true });
    }
  };

  // Handle URL extraction
  const handleUrlFetch = async () => {
    if (!urlInput.trim()) return;

    setExtractError(null);
    setExtractSuccess(null);
    setExtracting(true);

    try {
      const res = await apiRequest<{
        text: string;
        word_count: number;
        truncated: boolean;
        url: string;
      }>('/sources/fetch-url', {
        method: 'POST',
        body: JSON.stringify({ url: urlInput }),
      });

      setValue('source_text', res.text, { shouldValidate: true });
      setSourceUrl(res.url);
      setSourceFilename(undefined);
      if (!watch('title')) {
        try {
          const u = new URL(res.url);
          setValue('title', `Video: ${u.hostname.replace('www.', '')}`);
        } catch {
          setValue('title', 'Web Article Video');
        }
      }

      setExtractSuccess(
        `Successfully fetched and parsed ${res.word_count} words from URL${
          res.truncated ? ' (truncated to 60,000 chars)' : ''
        }`
      );
    } catch (err: any) {
      setExtractError(err.message || 'Failed to fetch article from URL');
    } finally {
      setExtracting(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setExtractError(null);
    try {
      const payload = {
        ...values,
        source_type: activeTab,
        source_filename: sourceFilename,
        source_url: sourceUrl,
      };

      const project = await apiRequest<any>('/projects', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Navigate to project hub to begin analysis pipeline
      navigate(`/projects/${project.id}`);
    } catch (err: any) {
      setExtractError(err.message || 'Failed to create video project');
    } finally {
      setSubmitting(false);
    }
  };

  const wordCount = sourceText.trim() ? sourceText.trim().split(/\s+/).length : 0;
  const charCount = sourceText.length;
  const isTextValid = charCount >= 200 && charCount <= 60000;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Create New Video Project</h1>
        <p className="text-sm text-slate-400 mt-1">
          Ingest your source text knowledge and configure your multimodal production preferences
        </p>
      </div>

      {extractError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{extractError}</span>
        </div>
      )}

      {extractSuccess && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{extractSuccess}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Step 1: Source Ingestion */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-sm">
              1
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Source Knowledge Ingestion</h2>
              <p className="text-xs text-slate-400">Paste text, upload a document, or fetch from a web link</p>
            </div>
          </div>

          {/* Ingestion Tabs */}
          <div className="flex flex-wrap items-center gap-2 mb-6 p-1 bg-slate-950/60 rounded-xl border border-slate-800 w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('idea')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'idea'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lightbulb className="w-4 h-4 text-amber-300" />
              <span>AI Idea-to-Video</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'file'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Document-to-Explainer (.pdf, .docx)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'paste'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Paste Text</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'url'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Web Article URL</span>
            </button>
          </div>

          {activeTab === 'idea' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1.5">
                  <Wand2 className="w-4 h-4" />
                  <span>Enter any topic, idea, or concept</span>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  ReelForge AI will analyze the concept, create a high-converting hook, structure scenes, and generate full source material ready for production.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ideaInput}
                    onChange={(e) => setIdeaInput(e.target.value)}
                    placeholder="e.g. How Photosynthesis works in 60 seconds, or 5 common SaaS pricing mistakes..."
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleExpandIdea();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleExpandIdea}
                    disabled={isExpandingIdea || ideaInput.trim().length < 5}
                    className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {isExpandingIdea ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Expanding...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Generate Blueprint</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Suggestion Chips */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-slate-500">Quick ideas:</span>
                  {[
                    'Photosynthesis Explained Simply',
                    'How Compound Interest Creates Wealth',
                    '3 Mistakes First-Time Homebuyers Make',
                    'Understanding Quantum Computing Basics',
                  ].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setIdeaInput(s)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {ideaBlueprint && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                      Generated Concept Blueprint
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                      {ideaBlueprint.domain} • {ideaBlueprint.target_duration_seconds}s
                    </span>
                  </div>
                  <div className="text-xs text-slate-300">
                    <span className="font-semibold text-white">Title: </span> {ideaBlueprint.title}
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1">Key Takeaways:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {ideaBlueprint.key_takeaways.map((k, i) => (
                        <div key={i} className="text-[11px] text-slate-400 flex items-start gap-1.5">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>{k}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'paste' && (
            <div>
              <textarea
                {...register('source_text')}
                rows={8}
                placeholder="Paste your blog post, lecture notes, agronomy guide, market report, or research summary here (min 200 characters)..."
                className="w-full p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs leading-relaxed"
              />
            </div>
          )}

          {activeTab === 'file' && (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-950/40 transition group">
                <Upload className="w-10 h-10 text-slate-500 group-hover:text-emerald-400 transition mb-3" />
                <span className="text-sm font-semibold text-white mb-1">
                  Click or drag and drop document here
                </span>
                <span className="text-xs text-slate-500">
                  Supports .pdf, .docx, .txt, .md (max 5 MB)
                </span>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={extracting}
                />
              </label>
              {extracting && (
                <div className="flex items-center justify-center gap-2 text-xs text-emerald-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Extracting document text & analyzing educational topics...</span>
                </div>
              )}

              {/* Document Topic Breakdown Picker */}
              {documentTopics && documentTopics.topics?.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <span>Detected Document Topics (Select One or Whole Document)</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      Subject: {documentTopics.detected_subject}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {documentTopics.document_summary}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSelectTopic('all')}
                      className={`p-3 rounded-lg text-left border text-xs transition ${
                        selectedTopicId === 'all'
                          ? 'bg-emerald-500/10 border-emerald-500 text-white font-semibold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="block font-bold text-white mb-0.5">📚 Full Document</span>
                      <span className="text-[10px] text-slate-500">Create comprehensive explainer across all sections</span>
                    </button>
                    {documentTopics.topics.map((t) => {
                      const isSelected = selectedTopicId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleSelectTopic(t.id)}
                          className={`p-3 rounded-lg text-left border text-xs transition ${
                            isSelected
                              ? 'bg-emerald-500/10 border-emerald-500 text-white font-semibold'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="block font-bold text-white mb-0.5">{t.title}</span>
                          <span className="text-[10px] text-slate-500 line-clamp-2">{t.summary}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'url' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/article-or-guide"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
                <button
                  type="button"
                  onClick={handleUrlFetch}
                  disabled={extracting || !urlInput.trim()}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center gap-2 disabled:opacity-50"
                >
                  {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                  <span>Fetch & Extract</span>
                </button>
              </div>
            </div>
          )}

          {/* Source Live Meter */}
          <div className="mt-4 flex flex-wrap items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/60">
            <div className="flex items-center gap-4">
              <span className={isTextValid ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                {charCount.toLocaleString()} / 60,000 characters
              </span>
              <span>•</span>
              <span>{wordCount.toLocaleString()} words</span>
            </div>
            <div>
              {charCount > 0 && charCount < 200 && (
                <span className="text-rose-400">Need at least 200 characters</span>
              )}
              {isTextValid && (
                <span className="text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Ready for video configuration</span>
                </span>
              )}
            </div>
          </div>
          {errors.source_text && (
            <p className="text-xs text-rose-400 mt-2">{errors.source_text.message}</p>
          )}
        </div>

        {/* Step 2: Video Configuration Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold text-sm">
              2
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Video Creative Configuration</h2>
              <p className="text-xs text-slate-400">
                Tailor domain tone, platform aspect ratio, duration, and AI synthesis styling
              </p>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Project Video Title
            </label>
            <input
              type="text"
              {...register('title')}
              placeholder="e.g. Master Class: Optimal Soil Preparation for Tomato Crops"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
            {errors.title && <p className="text-xs text-rose-400 mt-1">{errors.title.message}</p>}
          </div>

          {/* Domain Picker */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Target Knowledge Domain
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {DOMAIN_KEYS.map((key) => {
                const isSelected = selectedDomain === key;
                const meta = DOMAINS[key as DomainKey];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleDomainChange(key as DomainKey)}
                    className={`p-3.5 rounded-xl text-left border transition ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500 text-white'
                        : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="block text-xs font-bold text-white mb-0.5">{meta.label}</span>
                    <span className="block text-[10px] text-slate-500 truncate">{meta.typicalSources}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Platform & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Target Platform
              </label>
              <select
                value={selectedPlatform}
                onChange={(e) => handlePlatformChange(e.target.value as TargetPlatform)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="youtube_shorts">YouTube Shorts (9:16 Vertical)</option>
                <option value="instagram_reels">Instagram Reels (9:16 Vertical)</option>
                <option value="tiktok">TikTok (9:16 Vertical)</option>
                <option value="youtube_long">YouTube Standard (16:9 Landscape)</option>
                <option value="linkedin">LinkedIn Post (1:1 Square)</option>
                <option value="custom">Custom Format</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Target Duration: <span className="text-emerald-400 font-bold">{currentDuration}s</span>
                </label>
                <span className="text-[10px] text-slate-500">
                  Approx. {Math.max(3, Math.floor(currentDuration / 6))} scenes
                </span>
              </div>
              <input
                type="range"
                min={15}
                max={['youtube_shorts', 'tiktok', 'instagram_reels'].includes(selectedPlatform) ? 90 : 180}
                step={5}
                {...register('target_duration_seconds')}
                className="w-full accent-emerald-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
              />
              {errors.target_duration_seconds && (
                <p className="text-xs text-rose-400 mt-1">{errors.target_duration_seconds.message}</p>
              )}
            </div>
          </div>

          {/* Tone, Language, Voice */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Narration Tone
              </label>
              <select
                {...register('tone')}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Language
              </label>
              <select
                {...register('language')}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {LANGUAGE_LABELS[l as Language] || l}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Gemini Voice
              </label>
              <select
                {...register('voice_name')}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {VOICE_NAMES.map((v) => (
                  <option key={v} value={v}>
                    {v} ({VOICES[v as VoiceName]?.gender}) — {VOICES[v as VoiceName]?.description.slice(0, 25)}...
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Visual Style & Audience */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Visual Art Style
              </label>
              <select
                {...register('visual_style')}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {VISUAL_STYLES.map((vs) => (
                  <option key={vs} value={vs}>
                    {vs.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Target Audience (optional)
              </label>
              <input
                type="text"
                {...register('audience')}
                placeholder="e.g. Smallholder farmers in dryland regions"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* CTA & Extra Instructions */}
          <div className="space-y-4 pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('include_cta')}
                className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-800 border-slate-700"
              />
              <span className="text-xs text-slate-300">
                Include a concluding Call to Action (CTA) in the final scene
              </span>
            </label>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Additional Creative Instructions (optional)
              </label>
              <input
                type="text"
                {...register('extra_instructions')}
                placeholder="e.g. Focus on natural pest management methods; emphasize seasonal timing"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-6 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={submitting || !isTextValid}
              className="px-8 py-3.5 rounded-xl font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20 flex items-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Creating Studio Project...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Create Project & Proceed to AI Analysis</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
