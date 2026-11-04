import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/apiClient';
import { LANGUAGES, LANGUAGE_LABELS, Language } from '@reelforge/shared';
import {
  Globe,
  X,
  Loader2,
  AlertTriangle,
  Languages,
} from 'lucide-react';

interface TranslateModalProps {
  projectId: string;
  currentLanguage: string;
  isOpen: boolean;
  onClose: () => void;
}

export const TranslateModal: React.FC<TranslateModalProps> = ({
  projectId,
  currentLanguage,
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [selectedLang, setSelectedLang] = useState<Language>(
    currentLanguage === 'en' ? 'es' : 'en'
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const translateMutation = useMutation({
    mutationFn: (targetLanguage: Language) =>
      apiRequest(`/projects/${projectId}/translate`, {
        method: 'POST',
        body: JSON.stringify({ target_language: targetLanguage }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-scripts', projectId] });
      onClose();
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to translate video script');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Multilingual Video Translation</h3>
              <p className="text-[11px] text-slate-400">Translate script, scenes & subtitle tracks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Target Language</label>
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value as Language)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {LANGUAGE_LABELS[lang] || lang} ({lang.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <p className="text-slate-300 font-medium">What happens next:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>AI translates narration, titles, hooks, and burned-in captions naturally.</li>
              <li>Scene durations, pacing, and visual prompts are preserved.</li>
              <li>Saved as a new script version, so you can switch back anytime.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={translateMutation.isPending}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={() => translateMutation.mutate(selectedLang)}
            disabled={translateMutation.isPending}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-purple-600/20"
          >
            {translateMutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Translating...
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5" />
                Translate Video
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

