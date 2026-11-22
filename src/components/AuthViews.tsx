import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../lib/api';
import { AppRoute } from '../types/sportzone';

interface AuthViewsProps {
  mode: 'login' | 'register' | 'reset-password';
  onNavigate: (route: AppRoute) => void;
}

export function AuthViews({ mode, onNavigate }: AuthViewsProps) {
  const { loginWithEmail, registerWithEmail, loginWithGoogle } = useAuth();
  const { showToast } = useToast();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [submitting, setSubmitting] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setAuthNotice(null);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
        showToast('Signed in to SPORTZONE.', 'success');
        onNavigate('home');
      } else if (mode === 'register') {
        await registerWithEmail(username, email, password);
        showToast('Account created with 0.00 DT starting balance.', 'success');
        onNavigate('dashboard');
      } else if (mode === 'reset-password') {
        if (resetStep === 'request') {
          const res = await apiFetch<{ message: string; simulationResetCode?: string }>(
            '/api/auth/reset-password/request',
            {
              method: 'POST',
              body: JSON.stringify({ email }),
            }
          );
          if (res.simulationResetCode) {
            setIssuedCode(res.simulationResetCode);
          }
          setResetStep('confirm');
          showToast(res.message, 'info');
        } else {
          const res = await apiFetch<{ message: string }>('/api/auth/reset-password/confirm', {
            method: 'POST',
            body: JSON.stringify({ email, code: resetCode, newPassword: password }),
          });
          showToast(res.message, 'success');
          onNavigate('login');
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed.';
      setAuthNotice(msg);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setAuthNotice(null);
    try {
      await loginWithGoogle();
      showToast('Signed in with Google.', 'success');
      onNavigate('home');
    } catch (err: any) {
      const code = String(err?.code || '');
      const rawMsg = String(err?.message || '');

      if (code === 'auth/unauthorized-domain' || rawMsg.includes('auth/unauthorized-domain')) {
        const friendly =
          'Google Sign-In is only enabled on the primary app domain. Please use Email & Password below (works on all domains).';
        setAuthNotice(friendly);
        showToast('Please sign in or register with Email & Password below.', 'info');
        if (typeof document !== 'undefined') {
          document.getElementById('auth-email')?.focus();
        }
      } else if (code === 'auth/popup-closed-by-user') {
        setAuthNotice('Google sign-in popup was closed. You can try again or use Email & Password below.');
        showToast('Google sign-in cancelled.', 'info');
      } else if (code === 'auth/popup-blocked') {
        const friendly = 'Browser blocked the Google sign-in popup. Allow popups or sign in with Email & Password below.';
        setAuthNotice(friendly);
        showToast(friendly, 'error');
      } else {
        const friendly = rawMsg || 'Google sign-in failed or was cancelled.';
        setAuthNotice(friendly);
        showToast(friendly, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8">
      <div className="rounded-xl border border-zinc-800 bg-[#18181b] p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-extrabold text-white">
            {mode === 'login'
              ? 'Sign in to SPORTZONE'
              : mode === 'register'
              ? 'Create Account'
              : 'Reset Password'}
          </h1>
          <p className="text-sm text-zinc-400">
            {mode === 'register'
              ? 'New accounts start at 0.00 DT. An administrator can credit DT to your balance.'
              : mode === 'reset-password'
              ? 'Generate a verification code to reset your account password.'
              : 'Access your DT balance, live tickets, and real-time match center.'}
          </p>
        </div>

        {authNotice && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-200 leading-relaxed">
            {authNotice}
          </div>
        )}

        {mode !== 'reset-password' && (
          <>
            <button
              type="button"
              disabled={submitting}
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-zinc-700 bg-[#121214] hover:bg-zinc-900 text-white font-medium py-2.5 px-4 text-sm transition-colors min-h-[44px]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-zinc-800" />
              <span className="shrink mx-3 text-xs text-zinc-500">or with email</span>
              <div className="flex-grow border-t border-zinc-800" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-1.5">
              <label htmlFor="auth-username" className="block text-xs font-medium text-zinc-300">
                Username
              </label>
              <input
                id="auth-username"
                type="text"
                required
                minLength={3}
                maxLength={32}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Player216"
                className="w-full rounded-lg border border-zinc-700 bg-[#121214] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#f5b800] focus:outline-none"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="auth-email" className="block text-xs font-medium text-zinc-300">
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-lg border border-zinc-700 bg-[#121214] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#f5b800] focus:outline-none"
            />
          </div>

          {mode === 'reset-password' && resetStep === 'confirm' && (
            <>
              {issuedCode && (
                <div className="rounded-lg border border-[#f5b800]/40 bg-[#f5b800]/10 p-3 text-xs text-[#f5b800] flex items-center justify-between">
                  <span>Verification Code:</span>
                  <strong className="font-mono-tabular text-sm text-white">{issuedCode}</strong>
                </div>
              )}
              <div className="space-y-1.5">
                <label htmlFor="auth-reset-code" className="block text-xs font-medium text-zinc-300">
                  Reset Code
                </label>
                <input
                  id="auth-reset-code"
                  type="text"
                  required
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="Enter 6-character code"
                  className="w-full rounded-lg border border-zinc-700 bg-[#121214] px-3.5 py-2.5 text-sm font-mono-tabular text-white placeholder-zinc-500 focus:border-[#f5b800] focus:outline-none"
                />
              </div>
            </>
          )}

          {(mode !== 'reset-password' || resetStep === 'confirm') && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="auth-password" className="block text-xs font-medium text-zinc-300">
                  {mode === 'reset-password' ? 'New Password' : 'Password'}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => onNavigate('reset-password')}
                    className="text-xs text-[#f5b800] hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                id="auth-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full rounded-lg border border-zinc-700 bg-[#121214] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#f5b800] focus:outline-none"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#f5b800] hover:bg-[#fbbf24] disabled:bg-zinc-800 disabled:text-zinc-500 text-[#111111] font-bold py-2.5 px-4 text-sm transition-colors min-h-[44px]"
          >
            {submitting
              ? 'Please wait...'
              : mode === 'login'
              ? 'Sign In'
              : mode === 'register'
              ? 'Register (0.00 DT)'
              : resetStep === 'request'
              ? 'Request Reset Code'
              : 'Confirm New Password'}
          </button>
        </form>

        <div className="pt-2 border-t border-zinc-800 text-center text-xs text-zinc-400 space-y-2">
          {mode === 'login' ? (
            <p>
              New to SPORTZONE?{' '}
              <button
                type="button"
                onClick={() => onNavigate('register')}
                className="text-[#f5b800] hover:underline font-semibold"
              >
                Create an account
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="text-[#f5b800] hover:underline font-semibold"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
