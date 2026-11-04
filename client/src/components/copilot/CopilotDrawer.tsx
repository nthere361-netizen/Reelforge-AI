import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/apiClient';
import {
  Bot,
  X,
  Send,
  Loader2,
  Check,
  Wand2,
} from 'lucide-react';

interface CopilotDrawerProps {
  projectId: string;
  activeScript?: any;
  scenes?: any[];
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  actionPayload?: {
    hook?: string;
    scene_index?: number;
    narration?: string;
    visual_description?: string;
    on_screen_text?: string;
  };
  suggestedAction?: string;
  applied?: boolean;
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({
  projectId,
  activeScript,
  scenes = [],
}) => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: "👋 Hi! I'm your ReelForge Copilot. I can help rewrite scenes, make your opening hook punchier, simplify educational concepts, fix grammar, or suggest cinematic visuals. How can I assist with your video?",
    },
  ]);

  const quickPrompts = [
    { label: '⚡ Punchier Hook', prompt: 'Give me 3 punchier opening hooks that stop scrolling immediately.', action: 'punchy_hook' },
    { label: '✨ Simplify Explanation', prompt: 'Simplify the narration so a beginner or student understands it effortlessly.', action: 'simplify' },
    { label: '🎨 Cinematic Visuals', prompt: 'Improve the image prompt and camera motion for more cinematic drama.', action: 'chat' },
    { label: '🗣️ Conversational Tone', prompt: 'Make the script sound warm, friendly, and natural when spoken aloud.', action: 'change_tone' },
    { label: '📝 Fix Grammar', prompt: 'Check for grammar, punctuation, and awkward phrasing.', action: 'fix_grammar' },
  ];

  // Mutation: Ask Copilot
  const copilotMutation = useMutation({
    mutationFn: (opts: { message: string; actionType: string; sceneIndex?: number }) =>
      apiRequest<any>(`/projects/${projectId}/copilot`, {
        method: 'POST',
        body: JSON.stringify({
          message: opts.message,
          action_type: opts.actionType,
          scene_index: opts.sceneIndex,
        }),
      }),
    onSuccess: (data) => {
      const assistantMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: data.reply,
        actionPayload: data.action_payload,
        suggestedAction: data.suggested_action,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    },
    onError: (err: any) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ Copilot encountered an error: ${err.message || 'Please try again.'}`,
        },
      ]);
    },
  });

  // Apply suggestion
  const applySuggestion = async (msgId: string, payload: any) => {
    try {
      if (payload.hook && activeScript) {
        // Update script hook
        await apiRequest(`/scenes/${scenes[0]?.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ narration: payload.narration || payload.hook }),
        });
      }

      if (payload.scene_index !== undefined && scenes[payload.scene_index]) {
        const targetScene = scenes[payload.scene_index];
        const updateData: any = {};
        if (payload.narration) updateData.narration = payload.narration;
        if (payload.visual_description) updateData.visual_description = payload.visual_description;
        if (payload.on_screen_text) updateData.on_screen_text = payload.on_screen_text;

        await apiRequest(`/scenes/${targetScene.id}`, {
          method: 'PATCH',
          body: JSON.stringify(updateData),
        });
      }

      queryClient.invalidateQueries({ queryKey: ['project', projectId] });

      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, applied: true } : m))
      );
    } catch (err: any) {
      alert(`Failed to apply edit: ${err.message}`);
    }
  };

  const handleSend = (textToSend?: string, actionType: string = 'chat') => {
    const text = textToSend || inputMessage;
    if (!text.trim() || copilotMutation.isPending) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');

    copilotMutation.mutate({
      message: text,
      actionType,
      sceneIndex: selectedSceneIndex,
    });
  };

  return (
    <>
      {/* Floating Trigger Pill */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold shadow-2xl shadow-emerald-500/30 hover:scale-105 active:scale-95 transition group"
        >
          <Bot className="w-5 h-5 group-hover:rotate-12 transition" />
          <span className="text-sm">ReelForge Copilot</span>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-950"></span>
          </span>
        </button>
      )}

      {/* Drawer */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-slide-left">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 backdrop-blur">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                  ReelForge Copilot
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">AI</span>
                </h3>
                <p className="text-[11px] text-slate-400">Workflow & Script Assistant</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Context Scope Picker */}
          <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Target Scene:</span>
            <select
              value={selectedSceneIndex === undefined ? 'all' : selectedSceneIndex}
              onChange={(e) =>
                setSelectedSceneIndex(e.target.value === 'all' ? undefined : Number(e.target.value))
              }
              className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-slate-200 text-xs focus:outline-none"
            >
              <option value="all">Whole Script</option>
              {scenes.map((s) => (
                <option key={s.id} value={s.scene_index}>
                  Scene {s.scene_index + 1} ({s.duration_seconds}s)
                </option>
              ))}
            </select>
          </div>

          {/* Quick Prompts */}
          <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {quickPrompts.map((qp, i) => (
              <button
                key={i}
                onClick={() => handleSend(qp.prompt, qp.action)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-[11px] font-medium text-slate-300 transition shrink-0"
              >
                {qp.label}
              </button>
            ))}
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-emerald-500 text-slate-950 font-medium rounded-br-none'
                      : 'bg-slate-800/80 border border-slate-700/60 text-slate-200 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Actionable suggestion card */}
                  {msg.actionPayload && (
                    <div className="mt-3 p-2.5 rounded-xl bg-slate-900 border border-emerald-500/30 text-slate-300 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-emerald-400 font-bold">
                        <span className="flex items-center gap-1">
                          <Wand2 className="w-3 h-3" />
                          Proposed Edit
                        </span>
                        {msg.actionPayload.scene_index !== undefined && (
                          <span>Scene {msg.actionPayload.scene_index + 1}</span>
                        )}
                      </div>

                      {msg.actionPayload.narration && (
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold">Narration:</span>
                          <p className="text-white text-xs italic">"{msg.actionPayload.narration}"</p>
                        </div>
                      )}

                      {msg.actionPayload.hook && (
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold">Hook:</span>
                          <p className="text-white text-xs italic">"{msg.actionPayload.hook}"</p>
                        </div>
                      )}

                      <button
                        disabled={msg.applied}
                        onClick={() => applySuggestion(msg.id, msg.actionPayload)}
                        className={`w-full mt-1.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                          msg.applied
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default'
                            : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20'
                        }`}
                      >
                        {msg.applied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Applied to Project
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Apply Suggestion
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {copilotMutation.isPending && (
              <div className="flex gap-2.5 items-center text-xs text-slate-400">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 animate-pulse">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Footer */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/60 backdrop-blur">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask Copilot anything about your video..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || copilotMutation.isPending}
                className="p-2 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-40 transition shadow-md shadow-emerald-500/20"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

