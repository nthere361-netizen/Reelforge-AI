import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Video, UserPlus, AlertCircle, Loader2, Mail, ArrowRight, RefreshCw } from 'lucide-react';

const SignupSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  role: z.enum(['creator', 'marketer', 'educator']),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters long'),
});

type SignupFormValues = z.infer<typeof SignupSchema>;

export const Signup: React.FC = () => {
  const [authError, setAuthError] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(SignupSchema),
    defaultValues: {
      role: 'creator',
    },
  });

  const onSubmit = async (values: SignupFormValues) => {
    setAuthError(null);
    setResendStatus(null);
    setSubmitting(true);
    try {
      const cleanEmail = values.email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: values.password,
        options: {
          data: {
            full_name: values.fullName.trim(),
            role: values.role,
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        setAuthError(error.message);
        return;
      }

      // Supabase returns empty identities if user is already registered and email confirmation is active
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setAuthError(
          'An account with this email address already exists. Please sign in or reset your password.'
        );
        return;
      }

      if (data.session) {
        // Direct login if email confirmation is disabled
        navigate('/dashboard');
      } else {
        setRegisteredEmail(cleanEmail);
      }
    } catch (err: any) {
      setAuthError(err.message || 'An error occurred during account creation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!registeredEmail) return;
    setResending(true);
    setResendStatus(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: registeredEmail,
      });
      if (error) {
        setResendStatus(`Failed: ${error.message}`);
      } else {
        setResendStatus('Confirmation link resent! Please check your inbox and spam folder.');
      }
    } catch (err: any) {
      setResendStatus(err.message || 'Could not resend email');
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Create Studio Account</h1>
          <p className="text-sm text-slate-400 mt-1">Start generating multimodal video packages in minutes</p>
        </div>

        {authError && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{authError}</span>
          </div>
        )}

        {registeredEmail ? (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <Mail className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-white text-base">Check your email</h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    We sent an activation link to <strong className="text-emerald-400 font-medium">{registeredEmail}</strong>.
                    Please click the link in your email to confirm your account before logging in.
                  </p>
                </div>
              </div>

              {resendStatus && (
                <div className="text-xs text-slate-300 bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                  {resendStatus}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-emerald-500/20">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 font-medium disabled:opacity-50 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                  <span>{resending ? 'Resending...' : 'Resend Email'}</span>
                </button>
                <Link
                  to={`/login?email=${encodeURIComponent(registeredEmail)}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-semibold hover:bg-emerald-400 transition"
                >
                  <span>Proceed to Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                {...register('fullName')}
                placeholder="Jane Doe"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm"
              />
              {errors.fullName && <p className="text-xs text-rose-400 mt-1">{errors.fullName.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Your Primary Role
              </label>
              <select
                {...register('role')}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm"
              >
                <option value="creator">Content Creator (Reels / Shorts / TikTok)</option>
                <option value="marketer">Marketer (Product promos & commercial videos)</option>
                <option value="educator">Educator (Lecture & explainer videos)</option>
              </select>
              {errors.role && <p className="text-xs text-rose-400 mt-1">{errors.role.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                {...register('email')}
                placeholder="jane@example.com"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm"
              />
              {errors.email && <p className="text-xs text-rose-400 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Password (min 6 chars)
              </label>
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
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Register Account</span>
                </>
              )}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-400 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-semibold transition">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};
