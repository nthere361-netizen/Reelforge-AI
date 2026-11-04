import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Video, PlusCircle, LayoutDashboard, Settings, LogOut } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0B0B0F]/90 backdrop-blur border-b border-[#171722]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#818CF8] flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition">
            <Video className="w-5 h-5 text-white font-bold" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight text-[#F5F5FA] flex items-center gap-1.5">
              ReelForge <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-[#818CF8] border border-indigo-500/20 font-semibold">AI</span>
            </span>
            <p className="text-[10px] text-[#A1A1B5] hidden sm:block">Onyx Studio • Multimodal Video Engine</p>
          </div>
        </Link>

        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[#A1A1B5] hover:text-[#F5F5FA] hover:bg-[#171722] transition"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <Link
                to="/projects/new"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold bg-[#6366F1] text-white hover:bg-[#4F46E5] transition shadow-md shadow-indigo-500/20"
              >
                <PlusCircle className="w-4 h-4" />
                <span>New Project</span>
              </Link>
              <Link
                to="/settings"
                className="p-2 rounded-lg text-[#A1A1B5] hover:text-[#F5F5FA] hover:bg-[#171722] transition"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </Link>
              <button
                onClick={handleSignOut}
                className="p-2 rounded-lg text-[#A1A1B5] hover:text-rose-400 hover:bg-[#171722] transition"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-4 py-1.5 rounded-lg text-sm font-medium text-[#A1A1B5] hover:text-[#F5F5FA] hover:bg-[#171722] transition"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-[#6366F1] text-white hover:bg-[#4F46E5] transition shadow-md shadow-indigo-500/20"
              >
                Get Started
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};
