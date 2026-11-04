import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/apiClient';
import {
  Sparkles,
  FileVideo,
  Layers,
  Music,
  Play,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  Loader2,
  Tag,
  ListOrdered,
  Users,
  Compass,
  ShieldCheck,
  Share2,
  Globe,
} from 'lucide-react';
import { QualityAuditModal } from '../components/modals/QualityAuditModal';
import { RepurposeModal } from '../components/modals/RepurposeModal';
import { TranslateModal } from '../components/modals/TranslateModal';
import { CopilotDrawer } from '../components/copilot/CopilotDrawer';

const STATUS_STEPS = [
  { key: 'draft', label: '1. Ingested' },
  { key: 'analyzing', label: '2. Analysis' },
  { key: 'scripted', label: '3. Scripted' },
  { key: 'media_generating', label: '4. Media' },
  { key: 'ready', label: '5. Ready' },
];

export const ProjectHub: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [extraInstructions, setExtraInstructions] = useState('');
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showRepurposeModal, setShowRepurposeModal] = useState(false);
  const [showTranslateModal, setShowTranslateModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch project details
  const {
    data: project,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['project', id],
    queryFn: () => apiRequest<any>(`/projects/${id}`),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'analyzing' || status === 'media_generating' ? 3000 : false;
    },
  });

  // Fetch script versions
  const { data: versions } = useQuery({
    queryKey: ['project-scripts', id],
    queryFn: () => apiRequest<any[]>(`/projects/${id}/scripts`),
    enabled: !!id && !!project?.active_script,
  });

  // Mutation: Run Content Analysis
  const analyzeMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/projects/${id}/analyze`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to complete content analysis');
    },
  });

  // Mutation: Generate Script
  const scriptMutation = useMutation({
    mutationFn: (extra?: string) =>
      apiRequest(`/projects/${id}/script`, {
        method: 'POST',
        body: JSON.stringify({ extra_instructions: extra || undefined }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['project-scripts', id] });
      setShowRegenModal(false);
      setExtraInstructions('');
      setErrorMsg(null);
      // Navigate to editor
      navigate(`/projects/${id}/editor`);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to generate script');
    },
  });

  // Mutation: Activate Script Version
  const activateVersionMutation = useMutation({
    mutationFn: (scriptId: string) =>
      apiRequest(`/projects/${id}/scripts/${scriptId}/activate`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['project-scripts', id] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Project Not Found</h2>
        <p className="text-sm text-slate-400 mb-6">{(error as any)?.message || 'Project could not be loaded.'}</p>
        <Link to="/dashboard" className="px-4 py-2 bg-emerald-500 text-slate-950 rounded-xl font-semibold text-sm">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const analysis = project.analysis;
  const script = project.active_script;
  const scenes = project.scenes || [];
  const statusIndex = STATUS_STEPS.findIndex((s) => s.key === project.status);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700 uppercase tracking-wider">
              {project.domain}
            </span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-slate-400">{project.target_platform.replace('_', ' ')}</span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-slate-400">{project.aspect_ratio}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{project.title}</h1>
        </div>

        {/* Quick Route Nav Pills */}
        <div className="flex items-center flex-wrap gap-2">
          {script && (
            <>
              <button
                type="button"
                onClick={() => setShowAuditModal(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30 transition flex items-center gap-1.5 shadow-sm"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Fact-Check & Quality</span>
              </button>
              <button
                type="button"
                onClick={() => setShowRepurposeModal(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/30 transition flex items-center gap-1.5 shadow-sm"
              >
                <Share2 className="w-3.5 h-3.5 text-purple-400" />
                <span>Repurpose Video</span>
              </button>
              <button
                type="button"
                onClick={() => setShowTranslateModal(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 border border-cyan-500/30 transition flex items-center gap-1.5 shadow-sm"
              >
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span>Translate</span>
              </button>
              <Link
                to={`/projects/${id}/editor`}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700 border border-slate-700 transition flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Scene Editor</span>
              </Link>
              <Link
                to={`/projects/${id}/media`}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700 border border-slate-700 transition flex items-center gap-1.5"
              >
                <Music className="w-3.5 h-3.5 text-teal-400" />
                <span>Media Studio</span>
              </Link>
              <Link
                to={`/projects/${id}/preview`}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700 border border-slate-700 transition flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 text-cyan-400" />
                <span>Preview</span>
              </Link>
              <Link
                to={`/projects/${id}/export`}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700 border border-slate-700 transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Export</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Production Pipeline Progress Stepper */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
          Production Pipeline Progress
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {STATUS_STEPS.map((step, idx) => {
            const isCompleted = statusIndex > idx || project.status === 'ready';
            const isCurrent = project.status === step.key;
            return (
              <div
                key={step.key}
                className={`p-3 rounded-xl border text-center transition ${
                  isCurrent
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold'
                    : isCompleted
                    ? 'bg-slate-950/60 border-slate-800 text-slate-300'
                    : 'bg-slate-950/30 border-slate-800/40 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  {isCurrent && <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />}
                  <span className="text-xs">{step.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Domain Advisory Banner (Required per Section 8 & 14) */}
      {script?.advisory_note && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <span className="font-semibold block text-xs uppercase tracking-wider text-amber-400 mb-0.5">
              Domain Advisory Note ({project.domain.toUpperCase()})
            </span>
            <p className="text-xs leading-relaxed">{script.advisory_note}</p>
          </div>
        </div>
      )}

      {/* Content Analysis Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">AI Content Analysis</h2>
              <p className="text-xs text-slate-400">Distilled knowledge summary, topic, and beat structure</p>
            </div>
          </div>

          {!analysis ? (
            <button
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50"
            >
              {analyzeMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing Knowledge...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Run Content Analysis</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${analyzeMutation.isPending ? 'animate-spin' : ''}`} />
              <span>Re-analyze</span>
            </button>
          )}
        </div>

        {analysis ? (
          <div className="space-y-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Executive Summary
              </span>
              <p className="text-sm text-slate-200 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                {analysis.summary}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Key Points */}
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2 flex items-center gap-1.5">
                  <ListOrdered className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Ranked Key Insights ({analysis.key_points?.length || 0})</span>
                </span>
                <ul className="space-y-2">
                  {analysis.key_points?.map((pt: string, i: number) => (
                    <li
                      key={i}
                      className="text-xs text-slate-300 p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/60 flex items-start gap-2.5"
                    >
                      <span className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Audience & Beat Structure */}
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-teal-400" />
                    <span>Audience Insights</span>
                  </span>
                  <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/60 space-y-2 text-xs">
                    <p className="text-slate-300">
                      <span className="text-slate-500">Primary:</span> {analysis.audience_insights?.primary_audience}
                    </p>
                    <p className="text-slate-300">
                      <span className="text-slate-500">Level:</span>{' '}
                      <span className="capitalize font-semibold text-emerald-400">
                        {analysis.audience_insights?.knowledge_level}
                      </span>
                    </p>
                    {analysis.audience_insights?.pain_points?.length > 0 && (
                      <div className="pt-1">
                        <span className="text-slate-500 block mb-1">Pain Points:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.audience_insights.pain_points.map((p: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                    Recommended Storyboard Beats
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {analysis.recommended_structure?.map((b: any, i: number) => (
                      <div key={i} className="p-2 rounded-lg bg-slate-950/40 border border-slate-800/60">
                        <span className="text-[10px] uppercase font-bold text-cyan-400 block">{b.beat}</span>
                        <span className="text-[11px] text-slate-300">{b.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Script Trigger Callout */}
            {!script && (
              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => scriptMutation.mutate()}
                  disabled={scriptMutation.isPending}
                  className="px-6 py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                >
                  {scriptMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Forging Script & Visual Storyboard...</span>
                    </>
                  ) : (
                    <>
                      <FileVideo className="w-4 h-4" />
                      <span>Generate Script & Storyboard (AI)</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 text-xs">
            Run Content Analysis to extract structured topics, audience insights, and recommended storyboard beats.
          </div>
        )}
      </div>

      {/* Script & Storyboard Overview Section */}
      {script && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Script Version {script.version} (Active)
                </span>
                {versions && versions.length > 1 && (
                  <select
                    value={script.id}
                    onChange={(e) => activateVersionMutation.mutate(e.target.value)}
                    className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5 text-slate-300"
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.version} ({new Date(v.created_at).toLocaleDateString()}) {v.is_active ? '★' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <h2 className="text-xl font-bold text-white">{script.video_title}</h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRegenModal(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 flex items-center gap-1.5 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Regenerate (v{script.version + 1})</span>
              </button>
              <Link
                to={`/projects/${id}/editor`}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/20"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Open Scene Editor</span>
              </Link>
            </div>
          </div>

          {/* Hook & Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                Opening 3-Second Hook
              </span>
              <p className="text-sm text-white font-medium italic">"{script.hook}"</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-around text-center">
              <div>
                <span className="text-xs text-slate-500 block mb-0.5">Total Duration</span>
                <span className="text-lg font-bold text-white flex items-center justify-center gap-1">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  {script.total_duration_seconds}s
                </span>
              </div>
              <div className="w-px h-8 bg-slate-800"></div>
              <div>
                <span className="text-xs text-slate-500 block mb-0.5">Scenes Count</span>
                <span className="text-lg font-bold text-white flex items-center justify-center gap-1">
                  <Layers className="w-4 h-4 text-teal-400" />
                  {scenes.length}
                </span>
              </div>
            </div>
          </div>

          {/* Social Caption & Hashtags */}
          <div className="space-y-3 pt-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Social Caption & Post Copy
              </span>
              <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                {script.caption_text}
              </p>
            </div>

            {script.hashtags && script.hashtags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <Tag className="w-3.5 h-3.5 text-slate-500 mr-1" />
                {script.hashtags.map((h: string, i: number) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-full bg-slate-800 text-[11px] text-cyan-400 border border-slate-700/60 font-mono"
                  >
                    #{h}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Regeneration Modal */}
      {showRegenModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Regenerate Video Script (Version {script.version + 1})</h3>
            <p className="text-xs text-slate-400">
              Provide extra instructions to steer the AI scriptwriter. A new script version will be created, preserving your previous version in history.
            </p>
            <textarea
              rows={4}
              value={extraInstructions}
              onChange={(e) => setExtraInstructions(e.target.value)}
              placeholder="e.g. Make the hook more provocative; emphasize the third key point about soil nutrients; adjust narration to be even more conversational..."
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs leading-relaxed"
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRegenModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => scriptMutation.mutate(extraInstructions)}
                disabled={scriptMutation.isPending}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition flex items-center gap-2"
              >
                {scriptMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span>Generate Version {script.version + 1}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 7: Fact-Checking & Quality Audit Modal */}
      <QualityAuditModal
        projectId={id!}
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
      />

      {/* Feature 6: Repurpose Video Modal */}
      <RepurposeModal
        projectId={id!}
        isOpen={showRepurposeModal}
        onClose={() => setShowRepurposeModal(false)}
      />

      {/* Feature 5: Multilingual Translate Modal */}
      <TranslateModal
        projectId={id!}
        currentLanguage={project.language || 'en'}
        isOpen={showTranslateModal}
        onClose={() => setShowTranslateModal(false)}
      />

      {/* Feature 8: Embedded ReelForge Copilot Drawer */}
      <CopilotDrawer
        projectId={id!}
        activeScript={script}
        scenes={scenes}
      />
    </div>
  );
};
