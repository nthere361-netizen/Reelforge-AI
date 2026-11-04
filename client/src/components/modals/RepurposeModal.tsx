import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/apiClient';
import { RepurposeResponse } from '@reelforge/shared';
import {
  Sparkles,
  X,
  Copy,
  Check,
  Video,
  Share2,
  ListChecks,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface RepurposeModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const RepurposeModal: React.FC<RepurposeModalProps> = ({
  projectId,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'shorts' | 'hooks' | 'social' | 'summary'>('shorts');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const {
    data: rep,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<RepurposeResponse>({
    queryKey: ['repurpose-content', projectId],
    queryFn: () =>
      apiRequest<RepurposeResponse>(`/projects/${projectId}/repurpose`, {
        method: 'POST',
      }),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Share2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Multi-Channel Content Repurposing Suite
              </h2>
              <p className="text-xs text-slate-400">
                Transform this video into viral short cuts, 5 alternative hooks, and platform-tailored social posts
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Regenerate"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading && (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
              <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
              <div>
                <p className="text-white font-semibold text-sm">Synthesizing Multi-Platform Deliverables...</p>
                <p className="text-slate-400 text-xs mt-1">Generating Shorts cut, viral hooks, and native social captions</p>
              </div>
            </div>
          )}

          {isError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>Failed to repurpose content: {(error as any)?.message || 'Please retry.'}</span>
            </div>
          )}

          {rep && (
            <>
              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-800 gap-6 text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('shorts')}
                  className={`pb-2.5 transition border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'shorts'
                      ? 'border-cyan-400 text-cyan-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Video className="w-4 h-4" />
                  Shorts/Reels Cut ({rep.shorts_script.duration_seconds}s)
                </button>
                <button
                  onClick={() => setActiveTab('hooks')}
                  className={`pb-2.5 transition border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'hooks'
                      ? 'border-cyan-400 text-cyan-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  5 Viral Hooks
                </button>
                <button
                  onClick={() => setActiveTab('social')}
                  className={`pb-2.5 transition border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'social'
                      ? 'border-cyan-400 text-cyan-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Share2 className="w-4 h-4" />
                  Social Posts ({rep.social_posts.length})
                </button>
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`pb-2.5 transition border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'summary'
                      ? 'border-cyan-400 text-cyan-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <ListChecks className="w-4 h-4" />
                  Study Takeaways
                </button>
              </div>

              {/* Tab 1: Shorts Script */}
              {activeTab === 'shorts' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                        High-Impact 20-30s Short Cut
                      </span>
                      <button
                        onClick={() =>
                          handleCopy(
                            `HOOK: ${rep.shorts_script.hook}\n\nNARRATION:\n${rep.shorts_script.narration}`,
                            'shorts'
                          )
                        }
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition"
                      >
                        {copiedKey === 'shorts' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy Script
                          </>
                        )}
                      </button>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                        Instant Hook (First 3s):
                      </span>
                      <p className="text-white font-medium italic">"{rep.shorts_script.hook}"</p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                        Fast-Paced Narration:
                      </span>
                      <p className="text-slate-300 leading-relaxed whitespace-pre-line">
                        {rep.shorts_script.narration}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Viral Hooks */}
              {activeTab === 'hooks' && (
                <div className="space-y-3">
                  {rep.alternative_hooks.map((h, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs space-y-1.5 flex flex-col"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-bold text-[10px] uppercase">
                          {h.style}
                        </span>
                        <button
                          onClick={() => handleCopy(h.hook, `hook-${i}`)}
                          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
                        >
                          {copiedKey === `hook-${i}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          Copy
                        </button>
                      </div>
                      <p className="text-white font-medium text-xs">"{h.hook}"</p>
                      <p className="text-slate-400 text-[11px] italic">Why it works: {h.rationale}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 3: Social Posts */}
              {activeTab === 'social' && (
                <div className="space-y-4">
                  {rep.social_posts.map((post, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          {post.platform.replace('_', ' ')} Post
                        </span>
                        <button
                          onClick={() =>
                            handleCopy(
                              `${post.caption}\n\n${post.hashtags.map((h) => `#${h}`).join(' ')}`,
                              `social-${i}`
                            )
                          }
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition"
                        >
                          {copiedKey === `social-${i}` ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy Post
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-slate-300 text-xs whitespace-pre-line leading-relaxed">
                        {post.caption}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {post.hashtags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 4: Study Takeaways */}
              {activeTab === 'summary' && (
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Core Concept Summary
                    </span>
                    <button
                      onClick={() => handleCopy(rep.key_point_summary.map((k) => `• ${k}`).join('\n'), 'summary')}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition"
                    >
                      {copiedKey === 'summary' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy All
                        </>
                      )}
                    </button>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {rep.key_point_summary.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1.5" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

