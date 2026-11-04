import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/apiClient';
import { DOMAIN_KEYS, DOMAINS, DomainKey } from '@reelforge/shared';
import {
  PlusCircle,
  Search,
  Copy,
  Trash2,
  Clock,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Film,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Fetch projects list
  const { data, isLoading } = useQuery({
    queryKey: ['projects', searchTerm, selectedDomain, selectedStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('q', searchTerm);
      if (selectedDomain) params.append('domain', selectedDomain);
      if (selectedStatus) params.append('status', selectedStatus);
      return apiRequest<any>(`/projects?${params.toString()}`);
    },
  });

  // Duplicate project mutation
  const duplicateMutation = useMutation({
    mutationFn: (projectId: string) =>
      apiRequest(`/projects/${projectId}/duplicate`, {
        method: 'POST',
      }),
    onSuccess: (newProj: any) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setActionToast('Project duplicated successfully');
      setTimeout(() => setActionToast(null), 3000);
      navigate(`/projects/${newProj.id}`);
    },
  });

  // Delete project mutation
  const deleteMutation = useMutation({
    mutationFn: (projectId: string) =>
      apiRequest(`/projects/${projectId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setActionToast('Project deleted');
      setTimeout(() => setActionToast(null), 3000);
    },
  });

  const projects: any[] = data?.projects || [];
  const totalCount = data?.pagination?.total || 0;
  const readyCount = projects.filter((p) => p.status === 'ready').length;
  const totalDuration = projects.reduce((sum, p) => sum + (p.target_duration_seconds || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Studio Projects</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your multimodal text-to-video production pipeline
          </p>
        </div>

        <Link
          to="/projects/new"
          className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20 flex items-center gap-2 self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Video Project</span>
        </Link>
      </div>

      {actionToast && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionToast}</span>
        </div>
      )}

      {/* Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Total Projects</span>
          <span className="text-2xl font-black text-white">{totalCount}</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Production Ready</span>
          <span className="text-2xl font-black text-emerald-400">{readyCount}</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Active Pipeline</span>
          <span className="text-2xl font-black text-teal-400">{totalCount - readyCount}</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Total Target Video</span>
          <span className="text-2xl font-black text-cyan-400">
            {Math.round(totalDuration / 60)}m {totalDuration % 60}s
          </span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search projects by title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs focus:outline-none"
          >
            <option value="">All Domains</option>
            {DOMAIN_KEYS.map((k) => (
              <option key={k} value={k}>
                {DOMAINS[k as DomainKey]?.label || k}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="analyzing">Analyzing</option>
            <option value="scripted">Scripted</option>
            <option value="media_generating">Media Generating</option>
            <option value="ready">Ready</option>
          </select>
        </div>
      </div>

      {/* Projects Grid or Empty State */}
      {isLoading ? (
        <div className="flex items-center justify-center p-16">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-600 flex items-center justify-center mx-auto mb-4">
            <Film className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No video projects found</h3>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            {searchTerm || selectedDomain || selectedStatus
              ? 'Try adjusting your search criteria or clearing active filters.'
              : 'Paste an article or upload a document to forge your first multimodal video package.'}
          </p>
          <Link
            to="/projects/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create First Project</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj) => {
            const statusColors: Record<string, string> = {
              ready: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
              scripted: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
              media_generating: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
              analyzing: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
              draft: 'bg-slate-800 text-slate-400 border-slate-700',
            };

            return (
              <div
                key={proj.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between space-y-4 hover:border-slate-700 transition group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                        statusColors[proj.status] || statusColors.draft
                      }`}
                    >
                      {proj.status.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(proj.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <Link to={`/projects/${proj.id}`} className="block group-hover:text-emerald-400 transition">
                    <h3 className="text-base font-bold text-white line-clamp-2 mb-2">{proj.title}</h3>
                  </Link>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mb-3">
                    <span className="capitalize">{proj.domain}</span>
                    <span>•</span>
                    <span>{proj.target_platform.replace('_', ' ')}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-emerald-400" />
                      {proj.target_duration_seconds}s
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => duplicateMutation.mutate(proj.id)}
                      disabled={duplicateMutation.isPending}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
                      title="Duplicate Project"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this project and all its media?')) {
                          deleteMutation.mutate(proj.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition"
                      title="Delete Project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <Link
                    to={`/projects/${proj.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
                  >
                    <span>Open Hub</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
