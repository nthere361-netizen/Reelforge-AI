import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/apiClient';
import {
  Music,
  ImageIcon,
  Sparkles,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Volume2,
  ArrowRight,
  Maximize2,
} from 'lucide-react';

export const Media: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [activeAudioScene, setActiveAudioScene] = useState<string | null>(null);
  const [activeImageScene, setActiveImageScene] = useState<string | null>(null);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [forceRegen, setForceRegen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Fetch project details
  const { data: project, isLoading: isProjectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => apiRequest<any>(`/projects/${id}`),
    enabled: !!id,
    refetchInterval: (query) => {
      return query.state.data?.status === 'media_generating' ? 3000 : false;
    },
  });

  // Fetch signed URLs for media
  const { data: mediaUrls, isLoading: isMediaLoading } = useQuery({
    queryKey: ['project-media-urls', id],
    queryFn: () => apiRequest<any>(`/projects/${id}/media`),
    enabled: !!id,
    refetchInterval: () => {
      return project?.status === 'media_generating' ? 3000 : false;
    },
  });

  // Mutation: Generate Single Scene Audio (TTS)
  const audioMutation = useMutation({
    mutationFn: (sceneId: string) =>
      apiRequest(`/scenes/${sceneId}/audio`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['project-media-urls', id] });
      setActiveAudioScene(null);
      setSuccessToast(`Voiceover generated for scene.`);
      setTimeout(() => setSuccessToast(null), 3000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to synthesize voiceover audio');
      setActiveAudioScene(null);
    },
  });

  // Mutation: Generate Single Scene Image
  const imageMutation = useMutation({
    mutationFn: (sceneId: string) =>
      apiRequest(`/scenes/${sceneId}/image`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['project-media-urls', id] });
      setActiveImageScene(null);
      setSuccessToast(`Storyboard image generated.`);
      setTimeout(() => setSuccessToast(null), 3000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to generate scene visual image');
      setActiveImageScene(null);
    },
  });

  // Mutation: Generate All Media (Batch with concurrency)
  const generateAllMutation = useMutation({
    mutationFn: (force: boolean) =>
      apiRequest(`/projects/${id}/media/generate-all?force=${force ? 'true' : 'false'}`, {
        method: 'POST',
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['project-media-urls', id] });
      setSuccessToast(
        `Batch generation complete: ${data.ready ? 'All scenes ready' : 'Some media pending'}`
      );
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Batch media generation failed');
    },
  });

  // Mutation: Full Track Concatenation
  const fullTrackMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/projects/${id}/audio/full-track`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['project-media-urls', id] });
      setSuccessToast('Full voiceover track concatenated with 250ms silence intervals.');
      setTimeout(() => setSuccessToast(null), 3000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to concatenate full voiceover track');
    },
  });

  if (isProjectLoading || isMediaLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const scenes: any[] = project?.scenes || [];
  const audioMap: Record<string, string> = mediaUrls?.audio || {};
  const imageMap: Record<string, string> = mediaUrls?.images || {};
  const fullTrackUrl: string | undefined = mediaUrls?.fullTrackUrl;

  const audioCount = Object.keys(audioMap).length;
  const imageCount = Object.keys(imageMap).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to={`/projects/${id}`} className="text-xs text-slate-400 hover:text-white transition">
              ← Back to Project Hub
            </Link>
            <span className="text-xs text-slate-600">•</span>
            <span className="text-xs text-slate-400">Voice: {project.voice_name}</span>
            <span className="text-xs text-slate-600">•</span>
            <span className="text-xs text-slate-400">Style: {project.visual_style.replace('_', ' ')}</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Media Generation Studio</h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to={`/projects/${id}/preview`}
            className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20 flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Open Synchronized Preview</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {successToast && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Batch Generation Control Hub */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Automated Batch Synthesis Pipeline</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Generates voiceovers and storyboard images across all scenes with bounded concurrency (3x).
            </p>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={forceRegen}
                onChange={(e) => setForceRegen(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 bg-slate-800 border-slate-700"
              />
              <span>Force regenerate existing</span>
            </label>

            <button
              onClick={() => generateAllMutation.mutate(forceRegen)}
              disabled={generateAllMutation.isPending}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50"
            >
              {generateAllMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing All Media...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate All Media (Audio + Images)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
            <span className="flex items-center gap-2 text-slate-300">
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span>Voiceover Audio Progress</span>
            </span>
            <span className="font-bold text-white">
              {audioCount} / {scenes.length} Scenes Synthesized
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
            <span className="flex items-center gap-2 text-slate-300">
              <ImageIcon className="w-4 h-4 text-cyan-400" />
              <span>Storyboard Visuals Progress</span>
            </span>
            <span className="font-bold text-white">
              {imageCount} / {scenes.length} Images Generated
            </span>
          </div>
        </div>

        {/* Full Track Master Player */}
        {fullTrackUrl ? (
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-400 block uppercase tracking-wider">
                  Full Voiceover Master Track (Concatenated)
                </span>
                <span className="text-xs text-slate-400">All scenes merged with 250ms silence intervals</span>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <audio controls src={fullTrackUrl} className="h-9 w-full sm:w-64" />
              <button
                onClick={() => fullTrackMutation.mutate()}
                disabled={fullTrackMutation.isPending}
                className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition shrink-0"
                title="Re-concatenate Full Track"
              >
                <RefreshCw className={`w-4 h-4 ${fullTrackMutation.isPending ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        ) : audioCount === scenes.length && scenes.length > 0 ? (
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              All scene audio generated. Concatenate into a seamless single audio track for playback and export.
            </span>
            <button
              onClick={() => fullTrackMutation.mutate()}
              disabled={fullTrackMutation.isPending}
              className="px-4 py-2 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs hover:bg-teal-400 transition"
            >
              {fullTrackMutation.isPending ? 'Merging Tracks...' : 'Concatenate Full Track'}
            </button>
          </div>
        ) : null}
      </div>

      {/* Per-Scene Media Cards */}
      <div className="space-y-6">
        {scenes.map((scene, idx) => {
          const audioUrl = audioMap[scene.id];
          const imageUrl = imageMap[scene.id];
          const isSynthesizingAudio = activeAudioScene === scene.id || audioMutation.isPending && activeAudioScene === scene.id;
          const isGeneratingImage = activeImageScene === scene.id || imageMutation.isPending && activeImageScene === scene.id;

          return (
            <div
              key={scene.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-slate-800 text-emerald-400 font-bold text-xs flex items-center justify-center border border-slate-700">
                    {idx + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-white">Scene {idx + 1}</h3>
                    {scene.on_screen_text && (
                      <span className="text-xs text-cyan-400 font-medium">{scene.on_screen_text}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{scene.duration_seconds}s</span>
                  <span>•</span>
                  <span>{scene.camera_motion.replace(/_/g, ' ')}</span>
                </div>
              </div>

              {/* Narration Preview */}
              <p className="text-xs text-slate-300 italic bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                "{scene.narration}"
              </p>

              {/* Media Blocks Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Left Block: Audio Player & Action */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                      <span>Voiceover Audio (TTS)</span>
                    </span>
                    {audioUrl && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Ready
                      </span>
                    )}
                  </div>

                  {audioUrl ? (
                    <div className="space-y-3">
                      <audio controls src={audioUrl} className="w-full h-9" />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveAudioScene(scene.id);
                            audioMutation.mutate(scene.id);
                          }}
                          disabled={isSynthesizingAudio}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSynthesizingAudio ? 'animate-spin' : ''}`} />
                          <span>Regenerate Voice</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 space-y-3">
                      <p className="text-xs text-slate-500">Audio not yet generated for this scene</p>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveAudioScene(scene.id);
                          audioMutation.mutate(scene.id);
                        }}
                        disabled={isSynthesizingAudio}
                        className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition flex items-center gap-1.5 mx-auto"
                      >
                        {isSynthesizingAudio ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Synthesizing...</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Generate Voiceover</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Block: Image Visual Preview & Action */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-cyan-400" />
                      <span>Storyboard Visual Image</span>
                    </span>
                    {imageUrl && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        Ready
                      </span>
                    )}
                  </div>

                  {imageUrl ? (
                    <div className="space-y-3">
                      <div className="relative group rounded-xl overflow-hidden bg-slate-900 border border-slate-800 max-h-48 flex items-center justify-center">
                        <img
                          src={imageUrl}
                          alt={`Scene ${idx + 1}`}
                          className="object-cover w-full h-48 cursor-pointer group-hover:scale-105 transition duration-300"
                          onClick={() => setLightboxImg(imageUrl)}
                        />
                        <button
                          type="button"
                          onClick={() => setLightboxImg(imageUrl)}
                          className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition"
                        >
                          <Maximize2 className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveImageScene(scene.id);
                            imageMutation.mutate(scene.id);
                          }}
                          disabled={isGeneratingImage}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingImage ? 'animate-spin' : ''}`} />
                          <span>Regenerate Visual</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 space-y-3">
                      <p className="text-xs text-slate-500">Visual image pending generation</p>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveImageScene(scene.id);
                          imageMutation.mutate(scene.id);
                        }}
                        disabled={isGeneratingImage}
                        className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition flex items-center gap-1.5 mx-auto"
                      >
                        {isGeneratingImage ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Generating Image...</span>
                          </>
                        ) : (
                          <>
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Generate Scene Visual</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox Modal */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImg(null)}
        >
          <div className="max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-800 shadow-2xl">
            <img src={lightboxImg} alt="Lightbox Preview" className="max-h-[85vh] object-contain mx-auto" />
          </div>
        </div>
      )}
    </div>
  );
};
