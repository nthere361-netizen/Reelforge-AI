import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/apiClient';
import { DOMAINS, DOMAIN_KEYS, DomainKey } from '@reelforge/shared';
import { LANGUAGES, LANGUAGE_LABELS, Language } from '@reelforge/shared';
import { VOICES, VOICE_NAMES, VoiceName } from '@reelforge/shared';
import { Settings as SettingsIcon, Save, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const Settings: React.FC = () => {
  const queryClient = useQueryClient();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiRequest<any>('/me'),
  });

  const mutation = useMutation({
    mutationFn: (values: any) =>
      apiRequest('/me', {
        method: 'PATCH',
        body: JSON.stringify(values),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['me'], updated);
      setSuccessMsg('Studio profile and default preferences saved successfully.');
      setErrorMsg(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to update preferences');
      setSuccessMsg(null);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const updates = {
      full_name: formData.get('full_name') as string,
      role: formData.get('role') as string,
      default_domain: formData.get('default_domain') as string,
      default_language: formData.get('default_language') as string,
      default_voice: formData.get('default_voice') as string,
    };
    mutation.mutate(updates);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 flex items-center justify-center">
          <SettingsIcon className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Studio Settings</h1>
          <p className="text-xs text-slate-400">Configure your profile identity and video default templates</p>
        </div>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <div>
          <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-slate-800">
            Profile Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                name="full_name"
                defaultValue={profile?.full_name || ''}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Primary Creator Role
              </label>
              <select
                name="role"
                defaultValue={profile?.role || 'creator'}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition text-sm"
              >
                <option value="creator">Content Creator</option>
                <option value="marketer">Marketer</option>
                <option value="educator">Educator</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-slate-800">
            Default Video Generation Defaults
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Default Domain
              </label>
              <select
                name="default_domain"
                defaultValue={profile?.default_domain || 'general'}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition text-sm"
              >
                {DOMAIN_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {DOMAINS[key as DomainKey]?.label || key}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Default Language
              </label>
              <select
                name="default_language"
                defaultValue={profile?.default_language || 'en'}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition text-sm"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {LANGUAGE_LABELS[lang as Language] || lang}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Default Voiceover Voice
              </label>
              <select
                name="default_voice"
                defaultValue={profile?.default_voice || 'Kore'}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition text-sm"
              >
                {VOICE_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {name} ({VOICES[name as VoiceName]?.gender})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-6 py-2.5 rounded-xl font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20 flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Preferences</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
