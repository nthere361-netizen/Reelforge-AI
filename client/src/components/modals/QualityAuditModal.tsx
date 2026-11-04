import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/apiClient';
import { QualityAuditResponse } from '@reelforge/shared';
import {
  ShieldCheck,
  X,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Wand2,
} from 'lucide-react';

interface QualityAuditModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const QualityAuditModal: React.FC<QualityAuditModalProps> = ({
  projectId,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'facts' | 'clarity' | 'actions'>('facts');

  const {
    data: audit,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<QualityAuditResponse>({
    queryKey: ['quality-audit', projectId],
    queryFn: () =>
      apiRequest<QualityAuditResponse>(`/projects/${projectId}/quality-audit`, {
        method: 'POST',
      }),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Content Quality & Fact-Checking Audit
              </h2>
              <p className="text-xs text-slate-400">
                AI cross-references script narration against source text and grades clarity
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Re-run Audit"
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
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
              <div>
                <p className="text-white font-semibold text-sm">Analyzing Script & Source Grounding...</p>
                <p className="text-slate-400 text-xs mt-1">Verifying factual claims, hook retention, and readability</p>
              </div>
            </div>
          )}

          {isError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>Failed to audit script: {(error as any)?.message || 'Please retry.'}</span>
            </div>
          )}

          {audit && (
            <>
              {/* Scorecard Strip */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col items-center text-center">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Quality Score</span>
                  <span className="text-3xl font-extrabold text-emerald-400 mt-1">{audit.quality_score}/100</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Overall rating</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col items-center text-center">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Hook Strength</span>
                  <span className="text-3xl font-extrabold text-cyan-400 mt-1">{audit.hook_score}/100</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Opening 3s retention</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col items-center text-center">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Readability</span>
                  <span className="text-3xl font-extrabold text-amber-400 mt-1">{audit.readability_score}/100</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Pacing & delivery</span>
                </div>
              </div>

              {/* Overall Feedback */}
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300 leading-relaxed">
                <span className="font-bold text-white block mb-1">Executive Assessment:</span>
                {audit.overall_feedback}
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-800 gap-6 text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('facts')}
                  className={`pb-2.5 transition border-b-2 ${
                    activeTab === 'facts'
                      ? 'border-emerald-400 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  Factual Verification ({audit.factual_checks.length})
                </button>
                <button
                  onClick={() => setActiveTab('clarity')}
                  className={`pb-2.5 transition border-b-2 ${
                    activeTab === 'clarity'
                      ? 'border-emerald-400 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  Clarity & Repetition ({audit.clarity_issues.length + audit.repetitive_phrases.length})
                </button>
                <button
                  onClick={() => setActiveTab('actions')}
                  className={`pb-2.5 transition border-b-2 ${
                    activeTab === 'actions'
                      ? 'border-emerald-400 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  Actionable Fixes ({audit.actionable_improvements.length})
                </button>
              </div>

              {/* Tab 1: Factual Checks */}
              {activeTab === 'facts' && (
                <div className="space-y-3">
                  {audit.factual_checks.map((fc, i) => (
                    <div
                      key={i}
                      className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                        fc.status === 'supported'
                          ? 'bg-emerald-500/5 border-emerald-500/20'
                          : 'bg-amber-500/5 border-amber-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white italic">"{fc.claim}"</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            fc.status === 'supported'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {fc.status === 'supported' ? '✓ Grounded in Source' : '⚠️ Unverified Claim'}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px]">{fc.notes}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 2: Clarity & Repetition */}
              {activeTab === 'clarity' && (
                <div className="space-y-4">
                  {audit.repetitive_phrases.length > 0 && (
                    <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800 text-xs">
                      <span className="text-slate-400 font-semibold block mb-1.5">Repetitive Phrases Flagged:</span>
                      <div className="flex flex-wrap gap-2">
                        {audit.repetitive_phrases.map((rp, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-[11px]"
                          >
                            "{rp}"
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2.5">
                    {audit.clarity_issues.map((ci, i) => (
                      <div key={i} className="p-3.5 rounded-2xl bg-slate-850 border border-slate-800 text-xs space-y-1">
                        <span className="text-cyan-400 font-bold text-[11px]">Scene {ci.scene_index + 1} Clarity Notice:</span>
                        <p className="text-slate-300">{ci.issue}</p>
                        <p className="text-emerald-400/90 text-[11px] italic">Recommendation: {ci.suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: Actionable Fixes */}
              {activeTab === 'actions' && (
                <div className="space-y-3">
                  {audit.actionable_improvements.map((act, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs space-y-2 flex flex-col"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
                          {act.title}
                        </span>
                        {act.target_scene_index !== undefined && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            Scene {act.target_scene_index + 1}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400">{act.description}</p>
                      {act.proposed_text && (
                        <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 italic">
                          "{act.proposed_text}"
                        </div>
                      )}
                    </div>
                  ))}
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
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};

