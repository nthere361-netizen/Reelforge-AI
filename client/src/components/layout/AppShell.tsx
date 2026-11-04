import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

export const AppShell: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0B0B0F] text-[#F5F5FA] flex flex-col selection:bg-indigo-600/30 selection:text-indigo-200">
      <Navbar />
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
      <footer className="border-t border-[#171722] py-6 text-center text-xs text-[#A1A1B5] bg-[#0B0B0F]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} ReelForge AI. Intelligent Multimodal Text-to-Video Production Studio.</p>
          <p className="text-[#6B6B80]">Onyx Black • Electric Indigo • 100% Free Video Engine</p>
        </div>
      </footer>
    </div>
  );
};

