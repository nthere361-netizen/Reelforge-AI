import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/apiClient';
import {
  CameraMotion,
  Transition,
} from '@reelforge/shared';
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Sparkles,
  Save,
  PlusCircle,
  Clock,
  Eye,
  CheckCircle2,
  AlertCircle,
  Loader2,
  History,
} from 'lucide-react';
import { CopilotDrawer } from '../components/copilot/CopilotDrawer';

const CAMERA_MOTIONS: CameraMotion[] = [
  'static',
  'slow_zoom_in',
  'slow_zoom_out',
  'pan_left',
  'pan_right',
  'tilt_up',
  'tilt_down',
];

const TRANSITIONS: Transition[] = ['cut', 'fade', 'slide', 'zoom', 'dissolve'];

export const Editor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [savingSceneId, setSavingSceneId] = useState<string | null>(null);
  const [regenSceneId, setRegenSceneId] = useState<string | null>(null);
  const [regenInstruction, setRegenInstruction] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch project
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => apiRequest<any>(`/projects/${id}`),
    enabled: !!id,
  });

  // Fetch versions
  const { data: versions } = useQuery({
    queryKey: ['project-scripts', id],
    queryFn: () => apiRequest<any[]>(`/projects/${id}/scripts`),
    enabled: !!id,
  });

  // Mutation: Save Scene Edits
  const editMutation = useMutation({
    mutationFn: ({ sceneId, data }: { sceneId: string; data: any }) =>
      apiRequest(`/scenes/${sceneId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setSaveToast('Scene saved successfully');
      setSavingSceneId(null);
      setTimeout(() => setSaveToast(null), 3000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to save scene');
      setSavingSceneId(null);
    },
  });

  // Mutation: Reorder Scenes
  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiRequest(`/projects/${id}/scenes/order`, {
        method: 'PUT',
        body: JSON.stringify({ ordered_scene_ids: orderedIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
  });

  // Mutation: Delete Scene
  const deleteMutation = useMutation({
    mutationFn: (sceneId: string) =>
      apiRequest(`/scenes/${sceneId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setSaveToast('Scene removed');
      setTimeout(() => setSaveToast(null), 3000);
    },
  });

  // Mutation: Add Scene
  const addMutation = useMutation({
    mutationFn: (newScene: any) =>
      apiRequest(`/projects/${id}/scenes`, {
        method: 'POST',
        body: JSON.stringify(newScene),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setShowAddModal(false);
      setSaveToast('New scene added');
      setTimeout(() => setSaveToast(null), 3000);
    },
  });

  // Mutation: Regenerate Scene (AI)
  const regenMutation = useMutation({
    mutationFn: ({ sceneId, instruction }: { sceneId: string; instruction?: string }) =>
      apiRequest(`/scenes/${sceneId}/regenerate`, {
        method: 'POST',
        body: JSON.stringify({ instruction: instruction || undefined }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setRegenSceneId(null);
      setRegenInstruction('');
      setSaveToast('Scene regenerated successfully');
      setTimeout(() => setSaveToast(null), 3000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to regenerate scene');
    },
  });

  // Mutation: Switch Script Version
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

  const script = project?.active_script;
  const scenes: any[] = project?.scenes || [];
  const targetSeconds = project?.target_duration_seconds || 45;
  const currentTotal = scenes.reduce((sum, s) => sum + Number(s.duration_seconds || 0), 0);
  const diffPercent = Math.abs(currentTotal - targetSeconds) / targetSeconds;

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= scenes.length) return;

    const newOrder = [...scenes];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    reorderMutation.mutate(newOrder.map((s) => s.id));
  };

  const handleSceneFormSubmit = (sceneId: string, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingSceneId(sceneId);
    const form = new FormData(e.currentTarget);
    const payload = {
      narration: form.get('narration') as string,
      on_screen_text: form.get('on_screen_text') as string,
      visual_description: form.get('visual_description') as string,
      image_prompt: form.get('image_prompt') as string,
      duration_seconds: Number(form.get('duration_seconds')),
      camera_motion: form.get('camera_motion') as string,
      transition: form.get('transition') as string,
      mood: form.get('mood') as string,
      music_cue: form.get('music_cue') as string,
    };
    editMutation.mutate({ sceneId, data: payload });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to={`/projects/${id}`} className="text-xs text-slate-400 hover:text-white transition">
              ← Back to Project Hub
            </Link>
            <span className="text-xs text-slate-600">•</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-emerald-400">
              v{script?.version || 1}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Scene Storyboard Editor</h1>
        </div>

        {/* Duration & Version Pill */}
        <div className="flex items-center flex-wrap gap-4">
          {versions && versions.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
              <History className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={script?.id}
                onChange={(e) => activateVersionMutation.mutate(e.target.value)}
                className="bg-transparent text-slate-300 focus:outline-none"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id} className="bg-slate-900 text-white">
                    Version {v.version} {v.is_active ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Duration Meter */}
          <div
            className={`px-3.5 py-1.5 rounded-xl border text-xs flex items-center gap-2 ${
              diffPercent <= 0.1
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : diffPercent <= 0.15
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="font-semibold">
              Total: {currentTotal.toFixed(1)}s / {targetSeconds}s
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Scene</span>
          </button>
        </div>
      </div>

      {saveToast && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveToast}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Scenes List */}
      <div className="space-y-6">
        {scenes.map((scene, idx) => {
          const wordCount = scene.narration.split(/\s+/).filter(Boolean).length;
          const targetWords = Math.round(Number(scene.duration_seconds) * 2.5);
          const isSaving = savingSceneId === scene.id;

          return (
            <div
              key={scene.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg transition hover:border-slate-700/80"
            >
              <form onSubmit={(e) => handleSceneFormSubmit(scene.id, e)} className="space-y-4">
                {/* Scene Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/20">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-bold text-white">
                      Scene {idx + 1} of {scenes.length}
                    </span>
                    {idx === 0 && (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Opening Hook
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, 'up')}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Scene Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === scenes.length - 1}
                      onClick={() => handleMove(idx, 'down')}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Scene Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRegenSceneId(scene.id);
                        setRegenInstruction('');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-cyan-400 hover:bg-slate-700 text-xs flex items-center gap-1 ml-2 transition"
                      title="Regenerate Scene with AI"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">AI Regen</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(scene.id)}
                      className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition ml-1"
                      title="Delete Scene"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Form Inputs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* Left Column: Narration & On-screen text */}
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                          Spoken Narration (Voiceover)
                        </label>
                        <span className="text-[10px] text-slate-400">
                          {wordCount} words (~{targetWords} recommended)
                        </span>
                      </div>
                      <textarea
                        name="narration"
                        rows={3}
                        defaultValue={scene.narration}
                        className="w-full p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs leading-relaxed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                        On-Screen Headline Text (max 80 chars)
                      </label>
                      <input
                        type="text"
                        name="on_screen_text"
                        defaultValue={scene.on_screen_text || ''}
                        placeholder="Punchy on-screen caption..."
                        className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-cyan-300"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                          Duration (Seconds)
                        </label>
                        <input
                          type="number"
                          step={0.1}
                          min={1}
                          max={30}
                          name="duration_seconds"
                          defaultValue={scene.duration_seconds}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                          Mood
                        </label>
                        <input
                          type="text"
                          name="mood"
                          defaultValue={scene.mood || ''}
                          placeholder="e.g. Energetic, Focused"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Visual Storyboard & Image Prompt */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-teal-400" />
                        <span>Visual Scene Description</span>
                      </label>
                      <textarea
                        name="visual_description"
                        rows={2}
                        defaultValue={scene.visual_description}
                        className="w-full p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs leading-relaxed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                        Storyboard Image Prompt (English)
                      </label>
                      <textarea
                        name="image_prompt"
                        rows={2}
                        defaultValue={scene.image_prompt}
                        className="w-full p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs leading-relaxed font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                          Camera Motion
                        </label>
                        <select
                          name="camera_motion"
                          defaultValue={scene.camera_motion}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          {CAMERA_MOTIONS.map((m) => (
                            <option key={m} value={m}>
                              {m.replace(/_/g, ' ')}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                          Transition
                        </label>
                        <select
                          name="transition"
                          defaultValue={scene.transition}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          {TRANSITIONS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Save Scene Action Bar */}
                <div className="pt-3 border-t border-slate-800/60 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>Save Scene Changes</span>
                  </button>
                </div>
              </form>
            </div>
          );
        })}
      </div>

      {/* AI Single Scene Regeneration Modal */}
      {regenSceneId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <span>Regenerate Scene with AI</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              The AI will re-author this specific scene maintaining smooth continuity with the preceding and following scenes, while preserving visual style anchors.
            </p>
            <textarea
              rows={3}
              value={regenInstruction}
              onChange={(e) => setRegenInstruction(e.target.value)}
              placeholder="e.g. Make the narration punchier and more conversational; describe a macro closeup shot for the image prompt..."
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRegenSceneId(null)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  regenMutation.mutate({ sceneId: regenSceneId, instruction: regenInstruction })
                }
                disabled={regenMutation.isPending}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition flex items-center gap-1.5"
              >
                {regenMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Regenerating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Run Regeneration</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Scene Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Add New Scene</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                addMutation.mutate({
                  narration: form.get('narration') as string,
                  on_screen_text: (form.get('on_screen_text') as string) || '',
                  visual_description: form.get('visual_description') as string,
                  image_prompt: form.get('image_prompt') as string,
                  duration_seconds: Number(form.get('duration_seconds') || 5),
                  camera_motion: form.get('camera_motion') as string,
                  transition: form.get('transition') as string,
                  mood: (form.get('mood') as string) || '',
                  music_cue: (form.get('music_cue') as string) || '',
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Narration
                </label>
                <textarea
                  name="narration"
                  required
                  rows={2}
                  placeholder="Narration spoken during this scene..."
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Visual Description
                </label>
                <textarea
                  name="visual_description"
                  required
                  rows={2}
                  placeholder="Concrete visual layout..."
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Image Prompt (English)
                </label>
                <textarea
                  name="image_prompt"
                  required
                  rows={2}
                  placeholder="Photorealistic image prompt describing setting, lighting, subject..."
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Duration (s)
                  </label>
                  <input
                    type="number"
                    name="duration_seconds"
                    defaultValue={5}
                    min={1}
                    max={30}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Camera Motion
                  </label>
                  <select
                    name="camera_motion"
                    defaultValue="slow_zoom_in"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                  >
                    {CAMERA_MOTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition"
                >
                  {addMutation.isPending ? 'Adding Scene...' : 'Insert Scene'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Embedded ReelForge Copilot Drawer */}
      <CopilotDrawer
        projectId={id!}
        activeScript={project?.active_script}
        scenes={scenes}
      />
    </div>
  );
};
