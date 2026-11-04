import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, FileText, Music, Image as ImageIcon, ArrowRight } from 'lucide-react';

export const Landing: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-24 lg:pt-32 lg:pb-36">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),rgba(255,255,255,0))]"></div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Next-Gen Generative Multimodal Video Engine</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6">
            Convert Any Text Into a{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Ready-to-Post Short Video
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed">
            Turn blogs, articles, research notes, and documents into complete vertical videos with scene-by-scene scripts, realistic AI voiceovers, photorealistic storyboards, and synchronized captions—in under 3 minutes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/signup"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 group"
            >
              <span>Start Forging Free</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition border border-slate-700 flex items-center justify-center gap-2"
            >
              <span>Sign In to Studio</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-20 bg-slate-950/50 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">All-In-One Multimodal Studio Pipeline</h2>
            <p className="text-slate-400 text-sm max-w-2xl mx-auto">
              No need to switch between four different AI tools. ReelForge handles every step natively on the server.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/30 transition">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-5">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Multimodal Source Ingestion</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Paste raw text, upload documents (.txt, .md, .docx, .pdf), or fetch directly from any public URL with SSRF protection.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/30 transition">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-5">
                <Music className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Gemini Studio Voiceovers</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                High-fidelity 24kHz speech generation with 8 distinct expressive voices tuned to your exact tone and pacing requirements.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/30 transition">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-5">
                <ImageIcon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Visual Storyboarding</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Domain-tailored visual style anchors generating cohesive scene images with camera motion and transitions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">How It Works in 4 Simple Steps</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: '01', title: 'Ingest Source', desc: 'Paste text, upload a PDF/Docx, or supply a web link.' },
              { step: '02', title: 'AI Plan & Script', desc: 'Get key insights, hook, and timed scene breakdown.' },
              { step: '03', title: 'Media Synthesis', desc: 'Generate high-res visuals and studio voiceover in sync.' },
              { step: '04', title: 'Preview & Export', desc: 'Play in-browser with Ken Burns motion, export SRT, WAV & PDF.' },
            ].map((s, i) => (
              <div key={i} className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 relative">
                <span className="text-3xl font-black text-emerald-500/20 mb-2 block">{s.step}</span>
                <h4 className="text-base font-semibold text-white mb-1">{s.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
