import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../lib/apiClient';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Layers,
  Download,
  Loader2,
} from 'lucide-react';

interface TimelineScene {
  id: string;
  index: number;
  start: number; // in seconds
  end: number;
  duration: number;
  imageUrl?: string;
  audioUrl?: string;
  motion: string;
  transition: string;
  onScreenText: string;
  narration: string;
  visualDescription: string;
  captionChunks: Array<{ text: string; start: number; end: number }>;
}

export const Preview: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  // Fetch project
  const { data: project, isLoading: isProjLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => apiRequest<any>(`/projects/${id}`),
    enabled: !!id,
  });

  // Fetch media URLs
  const { data: mediaUrls, isLoading: isMediaLoading } = useQuery({
    queryKey: ['project-media-urls', id],
    queryFn: () => apiRequest<any>(`/projects/${id}/media`),
    enabled: !!id,
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);

  // Build timeline per Appendix C
  const scenes: any[] = project?.scenes || [];
  const audioMap: Record<string, string> = mediaUrls?.audio || {};
  const imageMap: Record<string, string> = mediaUrls?.images || {};
  const fullTrackUrl: string | undefined = mediaUrls?.fullTrackUrl;

  const timeline: TimelineScene[] = useMemo(() => {
    let currentStart = 0;
    return scenes.map((sc, i) => {
      const durSec = Number(sc.duration_seconds) || 5;
      const end = currentStart + durSec;

      // Split narration into chunks of max 8 words
      const words = sc.narration.split(/\s+/).filter(Boolean);
      const chunks: string[] = [];
      for (let w = 0; w < words.length; w += 8) {
        chunks.push(words.slice(w, w + 8).join(' '));
      }
      if (chunks.length === 0) chunks.push(sc.narration);

      const chunkDur = durSec / chunks.length;
      const captionChunks = chunks.map((c, cIdx) => ({
        text: c,
        start: currentStart + cIdx * chunkDur,
        end: currentStart + (cIdx + 1) * chunkDur,
      }));

      const item: TimelineScene = {
        id: sc.id,
        index: i,
        start: currentStart,
        end,
        duration: durSec,
        imageUrl: imageMap[sc.id],
        audioUrl: audioMap[sc.id],
        motion: sc.camera_motion || 'slow_zoom_in',
        transition: sc.transition || 'cut',
        onScreenText: sc.on_screen_text || '',
        narration: sc.narration || '',
        visualDescription: sc.visual_description || '',
        captionChunks,
      };

      currentStart = end;
      return item;
    });
  }, [scenes, audioMap, imageMap]);

  const totalDuration = timeline.length > 0 ? timeline[timeline.length - 1].end : 0;

  // Active scene and caption chunk
  const activeSceneIndex = timeline.findIndex(
    (s) => currentTime >= s.start && currentTime < s.end
  );
  const currentScene = activeSceneIndex !== -1 ? timeline[activeSceneIndex] : timeline[0];

  // Active scene relative progress [0, 1]
  const sceneProgress = currentScene
    ? Math.max(0, Math.min(1, (currentTime - currentScene.start) / (currentScene.duration || 1)))
    : 0;

  // Active caption
  const activeCaptionChunk = currentScene?.captionChunks.find(
    (c) => currentTime >= c.start && currentTime < c.end
  );
  const showHeadline = currentScene && currentTime - currentScene.start < 2.5;

  // Playback master clock tick
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      lastTickRef.current = null;
      if (audioRef.current && !audioRef.current.paused) audioRef.current.pause();
      return;
    }

    if (fullTrackUrl && audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.muted = isMuted;
      audioRef.current.play().catch(() => {});
    }

    const tick = (now: number) => {
      if (fullTrackUrl && audioRef.current) {
        // Sync directly to master audio clock
        const audioTime = audioRef.current.currentTime;
        setCurrentTime(audioTime);
        if (audioRef.current.ended || audioTime >= totalDuration) {
          setIsPlaying(false);
          setCurrentTime(0);
          return;
        }
      } else {
        // Fallback clock timer
        if (lastTickRef.current !== null) {
          const deltaSec = ((now - lastTickRef.current) / 1000) * playbackRate;
          setCurrentTime((prev) => {
            const next = prev + deltaSec;
            if (next >= totalDuration) {
              setIsPlaying(false);
              return 0;
            }
            return next;
          });
        }
        lastTickRef.current = now;
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, fullTrackUrl, playbackRate, isMuted, totalDuration]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seek(Math.max(0, currentTime - 5));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seek(Math.min(totalDuration, currentTime + 5));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, totalDuration]);

  const seek = (timeSec: number) => {
    setCurrentTime(timeSec);
    if (audioRef.current && fullTrackUrl) {
      audioRef.current.currentTime = timeSec;
    }
  };

  const handleNextScene = () => {
    if (activeSceneIndex < timeline.length - 1) {
      seek(timeline[activeSceneIndex + 1].start);
    }
  };

  const handlePrevScene = () => {
    if (activeSceneIndex > 0) {
      seek(timeline[activeSceneIndex - 1].start);
    }
  };

  if (isProjLoading || isMediaLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // Ken Burns Transform calculation per Appendix C rule 3
  const getKenBurnsTransform = (motion: string, progress: number) => {
    switch (motion) {
      case 'slow_zoom_in': {
        const scale = 1.0 + 0.12 * progress;
        return `scale(${scale.toFixed(4)})`;
      }
      case 'slow_zoom_out': {
        const scale = 1.12 - 0.12 * progress;
        return `scale(${scale.toFixed(4)})`;
      }
      case 'pan_left': {
        const x = -6 * progress;
        return `scale(1.10) translateX(${x.toFixed(2)}%)`;
      }
      case 'pan_right': {
        const x = 6 * progress - 3;
        return `scale(1.10) translateX(${x.toFixed(2)}%)`;
      }
      case 'tilt_up': {
        const y = -6 * progress;
        return `scale(1.10) translateY(${y.toFixed(2)}%)`;
      }
      case 'tilt_down': {
        const y = 6 * progress - 3;
        return `scale(1.10) translateY(${y.toFixed(2)}%)`;
      }
      case 'static':
      default:
        return 'none';
    }
  };

  // Determine frame aspect ratio styling
  const aspectClass =
    project?.aspect_ratio === '16:9'
      ? 'aspect-video max-w-3xl'
      : project?.aspect_ratio === '1:1'
      ? 'aspect-square max-w-lg'
      : 'aspect-[9/16] max-w-sm'; // default 9:16 vertical

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 w-full flex flex-col items-center space-y-6">
      {/* Hidden Master Audio Element */}
      {fullTrackUrl && (
        <audio
          ref={audioRef}
          src={fullTrackUrl}
          preload="auto"
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
        />
      )}

      {/* Header Bar */}
      <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to={`/projects/${id}`} className="text-xs text-slate-400 hover:text-white transition">
              ← Back to Project Hub
            </Link>
            <span className="text-xs text-slate-600">•</span>
            <span className="text-xs text-slate-400">
              Format: {project.target_platform} ({project.aspect_ratio})
            </span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">{project.title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/projects/${id}/export`}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Export Package</span>
          </Link>
        </div>
      </div>

      {/* Synchronized Player Frame */}
      <div
        className={`w-full ${aspectClass} relative rounded-3xl overflow-hidden bg-slate-950 border-2 border-slate-800 shadow-2xl flex items-center justify-center select-none`}
      >
        {currentScene?.imageUrl ? (
          <img
            src={currentScene.imageUrl}
            alt={`Scene ${currentScene.index + 1}`}
            className="w-full h-full object-cover will-change-transform"
            style={{
              transform: getKenBurnsTransform(currentScene.motion, sceneProgress),
              transition: 'transform 0.1s linear',
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-slate-900 to-slate-950">
            <Layers className="w-10 h-10 text-slate-700 mb-3" />
            <p className="text-xs text-slate-400 italic max-w-xs leading-relaxed">
              "{currentScene?.visualDescription || 'Visual image pending generation'}"
            </p>
          </div>
        )}

        {/* Burned-in Headline Text Overlay (First 2.5s) */}
        {showHeadline && currentScene?.onScreenText && (
          <div className="absolute top-12 inset-x-4 flex justify-center z-20 animate-fade-in">
            <div className="px-4 py-2 rounded-xl bg-slate-950/85 backdrop-blur-md border border-cyan-500/40 text-cyan-300 font-extrabold text-sm sm:text-base text-center shadow-2xl tracking-wide max-w-xs uppercase">
              {currentScene.onScreenText}
            </div>
          </div>
        )}

        {/* Burned-in Narration Caption Overlay */}
        {activeCaptionChunk && (
          <div className="absolute bottom-12 inset-x-4 flex justify-center z-20">
            <div className="px-4 py-2 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-700/60 text-white font-bold text-sm sm:text-base text-center shadow-2xl tracking-wide max-w-xs sm:max-w-md leading-snug">
              {activeCaptionChunk.text}
            </div>
          </div>
        )}

        {/* Top Watermark Pill */}
        <div className="absolute top-4 left-4 z-20 px-2.5 py-1 rounded-full bg-slate-950/70 backdrop-blur border border-slate-800 text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>Scene {activeSceneIndex + 1} / {timeline.length}</span>
        </div>
      </div>

      {/* Player Controls Bar */}
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        {/* Scrubber Timeline with Scene Markers */}
        <div className="relative w-full flex items-center">
          <input
            type="range"
            min={0}
            max={totalDuration || 1}
            step={0.05}
            value={currentTime}
            onChange={(e) => seek(Number(e.target.value))}
            className="w-full accent-emerald-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
          />
          {/* Scene split tick markers */}
          <div className="absolute inset-0 pointer-events-none flex justify-between">
            {timeline.map((sc, i) => (
              <div
                key={sc.id}
                className="w-0.5 h-2 bg-slate-600/80"
                style={{
                  left: `${(sc.start / (totalDuration || 1)) * 100}%`,
                  position: 'absolute',
                }}
                title={`Scene ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="font-mono text-emerald-400 font-semibold">
              {currentTime.toFixed(1)}s
            </span>
            <span className="text-slate-600">/</span>
            <span className="font-mono text-slate-400">{totalDuration.toFixed(1)}s</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevScene}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Previous Scene"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 font-bold flex items-center justify-center hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20"
              title="Play / Pause (Space)"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            <button
              onClick={handleNextScene}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Next Scene"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Playback speed selector */}
            <select
              value={playbackRate}
              onChange={(e) => setPlaybackRate(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 text-xs focus:outline-none"
            >
              <option value={0.75}>0.75x</option>
              <option value={1}>1.0x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
            </select>

            {/* Mute Toggle */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Toggle Audio"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
