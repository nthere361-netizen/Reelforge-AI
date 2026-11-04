import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Video, LogIn, AlertCircle, Loader2 } from 'lucide-react';

const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof LoginSchema>;

export const Login: React.FC = () => {
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const isExpired = searchParams.get('expired') === '1';
  const prefilledEmail = searchParams.get('email') || '';

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: prefilledEmail,
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setAuthError(null);
    setUnconfirmedEmail(null);
    setResendStatus(null);
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });

      if (error) {
        if (
          error.message.toLowerCase().includes('email not confirmed') ||
          error.message.toLowerCase().includes('not confirmed')
        ) {
          setUnconfirmedEmail(values.email.trim().toLowerCase());
          setAuthError(
            'Your email has not been confirmed yet. Please verify your email inbox or request a new confirmation link below.'
          );
        } else if (error.message.toLowerCase().includes('invalid login credentials')) {
          setAuthError(
            'Invalid email or password. Please verify your credentials or use "Forgot password?" to reset it.'
          );
        } else {
          setAuthError(error.message);
        }
        return;
      }

      navigate(from, { replace: true });
    } catch (err: any) {
      setAuthError(err.message || 'An unexpected error occurred during sign in');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!unconfirmedEmail) return;
    setResending(true);
    setResendStatus(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: unconfirmedEmail,
      });
      if (error) {
        setResendStatus(`Failed: ${error.message}`);
      } else {
        setResendStatus('Confirmation link sent! Please check your inbox and spam folder.');
      }
    } catch (err: any) {
      setResendStatus(err.message || 'Could not resend confirmation link');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl relative">
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Video className="w-6 h-6 text-slate-950 font-bold" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Welcome Back</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in to your ReelForge AI studio workspace</p>
        </div>

        {isExpired && !authError && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>Your previous session has expired. Please sign in again to continue.</span>
          </div>
        )}

        {authError && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex flex-col gap-2">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
            {unconfirmedEmail && (
              <div className="mt-2 pt-2 border-t border-rose-500/20 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resending}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-medium text-xs w-fit transition disabled:opacity-50"
                >
                  {resending ? 'Sending...' : 'Resend Email Confirmation Link'}
                </button>
                {resendStatus && (
                  <span className="text-xs text-slate-300 font-medium">{resendStatus}</span>
                )}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              {...register('email')}
              placeholder="creator@reelforge.ai"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm"
            />
            {errors.email && <p className="text-xs text-rose-400 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs text-emerald-400 hover:text-emerald-300 transition"
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              {...register('password')}
              placeholder="••••••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm"
            />
            {errors.password && <p className="text-xs text-rose-400 mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 rounded-xl font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign In to Studio</span>
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Don't have an account?{' '}
          <Link to="/signup" className="text-emerald-400 hover:text-emerald-300 font-semibold transition">
            Create Studio Account
          </Link>
        </p>
      </div>
    </div>
  );
};
