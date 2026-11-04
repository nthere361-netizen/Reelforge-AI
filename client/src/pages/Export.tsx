import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../lib/apiClient';
import {
  Download,
  FileCode,
  FileText,
  Music,
  Archive,
  FileSpreadsheet,
  Copy,
  CheckCircle2,
  Loader2,
  Play,
  Sparkles,
  Film,
} from 'lucide-react';

export const Export: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch project
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => apiRequest<any>(`/projects/${id}`),
    enabled: !!id,
  });

  const handleDownload = async (kind: string, filename: string) => {
    setDownloading(kind);
    try {
      const blob = await apiRequest<Blob>(`/projects/${id}/export/${kind}`, {
        method: 'GET',
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  };

  const handleCopyCaption = () => {
    if (!project?.active_script) return;
    const text = `${project.active_script.caption_text}\n\n${(project.active_script.hashtags || [])
      .map((h: string) => `#${h}`)
      .join(' ')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const script = project?.active_script;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to={`/projects/${id}`} className="text-xs text-slate-400 hover:text-white transition">
              ← Back to Project Hub
            </Link>
            <span className="text-xs text-slate-600">•</span>
            <span className="text-xs text-slate-400">{project.target_platform}</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Export Center</h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to={`/projects/${id}/preview`}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 flex items-center gap-1.5 transition"
          >
            <Play className="w-3.5 h-3.5 text-cyan-400" />
            <span>Open Preview Player</span>
          </Link>
        </div>
      </div>

      {/* Copy Post Caption & Hashtags Card */}
      {script && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Ready-to-Post Social Caption & Hashtags</span>
            </h2>
            <button
              onClick={handleCopyCaption}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Caption & Tags'}</span>
            </button>
          </div>
          <p className="text-xs text-slate-300 bg-slate-950/60 p-4 rounded-xl border border-slate-800 leading-relaxed font-mono">
            {script.caption_text}
            {script.hashtags && script.hashtags.length > 0 && (
              <span className="text-cyan-400 block mt-2">
                {script.hashtags.map((h: string) => `#${h}`).join(' ')}
              </span>
            )}
          </p>
        </div>
      )}

      {/* 6 Mandatory Export Format Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Highlighted Feature: Local Free MP4 Video Render */}
        <div className="bg-gradient-to-br from-[#171722] via-[#12121A] to-[#171722] border-2 border-indigo-500/40 rounded-2xl p-6 shadow-2xl flex flex-col justify-between space-y-4 hover:border-indigo-500 transition relative overflow-hidden group">
          <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-bl-xl tracking-wider">
            100% Free • Open-Source
          </div>
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Film className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Full Video Render (.mp4)</h3>
            <p className="text-xs text-[#A1A1B5] leading-relaxed">
              Synthesize your complete storyboard scenes, voiceover audio, dynamic zoom motion, and embedded burnt-in subtitles into a production MP4.
            </p>
          </div>
          <button
            onClick={() => handleDownload('video.mp4', 'reelforge-video.mp4')}
            disabled={downloading === 'video.mp4'}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#818CF8] hover:from-[#4F46E5] hover:to-[#6366F1] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition disabled:opacity-50"
          >
            {downloading === 'video.mp4' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Rendering Video (FFmpeg)...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Render & Download MP4 Video</span>
              </>
            )}
          </button>
        </div>

        {/* 1. SRT Captions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between space-y-4 hover:border-slate-700 transition">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">SRT Subtitles (.srt)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Standard SubRip format timed to exact speech timestamps and caption chunks with CRLF line breaks.
            </p>
          </div>
          <button
            onClick={() => handleDownload('srt', 'captions.srt')}
            disabled={downloading === 'srt'}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition disabled:opacity-50"
          >
            {downloading === 'srt' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Download Captions (SRT)</span>
          </button>
        </div>

        {/* 2. VTT Captions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between space-y-4 hover:border-slate-700 transition">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">WebVTT Captions (.vtt)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Modern web video caption standard compatible with HTML5 video players and online editors.
            </p>
          </div>
          <button
            onClick={() => handleDownload('vtt', 'captions.vtt')}
            disabled={downloading === 'vtt'}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition disabled:opacity-50"
          >
            {downloading === 'vtt' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Download Captions (VTT)</span>
          </button>
        </div>

        {/* 3. Voiceover WAV */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between space-y-4 hover:border-slate-700 transition">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Music className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Full Voiceover Audio (.wav)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Uncompressed 24kHz studio master track merging all scenes with 250ms silence intervals.
            </p>
          </div>
          <button
            onClick={() => handleDownload('audio', 'voiceover-full.wav')}
            disabled={downloading === 'audio'}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition disabled:opacity-50"
          >
            {downloading === 'audio' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Download Master WAV</span>
          </button>
        </div>

        {/* 4. Storyboard Images ZIP */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between space-y-4 hover:border-slate-700 transition">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Archive className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Images Package (.zip)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              ZIP archive containing all high-resolution storyboard images (01-scene.png, 02-scene.png) + prompts.txt.
            </p>
          </div>
          <button
            onClick={() => handleDownload('images.zip', 'storyboard-images.zip')}
            disabled={downloading === 'images.zip'}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition disabled:opacity-50"
          >
            {downloading === 'images.zip' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Download Images ZIP</span>
          </button>
        </div>

        {/* 5. Printable Storyboard PDF */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between space-y-4 hover:border-slate-700 transition">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Storyboard Document (.pdf)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Professional A4 landscape printable production storyboard with title page, hook, images, and scene notes.
            </p>
          </div>
          <button
            onClick={() => handleDownload('storyboard.pdf', 'storyboard.pdf')}
            disabled={downloading === 'storyboard.pdf'}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition disabled:opacity-50"
          >
            {downloading === 'storyboard.pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Download Storyboard PDF</span>
          </button>
        </div>

        {/* 6. Script JSON */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between space-y-4 hover:border-slate-700 transition">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <FileCode className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Structured Package (.json)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Complete machine-readable JSON containing project config, analysis, versioned script, and scene metadata.
            </p>
          </div>
          <button
            onClick={() => handleDownload('json', 'script-package.json')}
            disabled={downloading === 'json'}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition disabled:opacity-50"
          >
            {downloading === 'json' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Download Script JSON</span>
          </button>
        </div>
      </div>
    </div>
  );
};
