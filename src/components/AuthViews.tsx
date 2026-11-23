import React, { useState } from 'react';
import { Lock, Mail, User as UserIcon } from 'lucide-react';
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
        showToast('Connecté à MYBET.', 'success');
        onNavigate('home');
      } else if (mode === 'register') {
        await registerWithEmail(username, email, password);
        showToast('Compte créé avec un solde initial de 0.00 DT.', 'success');
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
      const msg = err?.message || 'Échec de l’authentification.';
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
      showToast('Connecté avec Google.', 'success');
      onNavigate('home');
    } catch (err: any) {
      const code = String(err?.code || '');
      const rawMsg = String(err?.message || '');

      if (code === 'auth/unauthorized-domain' || rawMsg.includes('auth/unauthorized-domain')) {
        const friendly =
          'La connexion Google est disponible sur le domaine principal. Utilisez votre e-mail et mot de passe ci-dessous.';
        setAuthNotice(friendly);
        showToast('Connectez-vous avec e-mail et mot de passe ci-dessous.', 'info');
        if (typeof document !== 'undefined') {
          document.getElementById('auth-email')?.focus();
        }
      } else if (code === 'auth/popup-closed-by-user') {
        setAuthNotice('Fenêtre Google fermée. Réessayez ou utilisez votre e-mail ci-dessous.');
        showToast('Connexion Google annulée.', 'info');
      } else if (code === 'auth/popup-blocked') {
        const friendly = 'Le navigateur a bloqué la fenêtre Google. Autorisez les popups ou utilisez votre e-mail.';
        setAuthNotice(friendly);
        showToast(friendly, 'error');
      } else {
        const friendly = rawMsg || 'La connexion Google a échoué ou a été annulée.';
        setAuthNotice(friendly);
        showToast(friendly, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 px-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-5 shadow-md">
        {/* Clean Brand Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center rounded-lg bg-[#091b35] px-2.5 py-1 text-xs font-black text-[#facc15]">
              MYBET
            </span>
            <h1 className="font-display text-2xl font-black uppercase text-[#091b35]">
              {mode === 'reset-password' ? 'Réinitialisation' : 'Connexion MYBET'}
            </h1>
          </div>
          <p className="text-xs font-bold text-slate-600">
            {mode === 'reset-password'
              ? 'Générez un code de vérification pour réinitialiser votre mot de passe.'
              : 'Portail Sportif Pro • MYBET'}
          </p>
        </div>

        {/* Underline Tab Switcher */}
        {mode !== 'reset-password' && (
          <div className="grid grid-cols-2 border-b border-slate-200 text-sm">
            <button
              type="button"
              onClick={() => {
                setAuthNotice(null);
                onNavigate('login');
              }}
              className={`pb-2.5 font-semibold transition-colors border-b-2 -mb-px ${
                mode === 'login'
                  ? 'border-[#0a58ca] text-[#0a58ca]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Se Connecter
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthNotice(null);
                onNavigate('register');
              }}
              className={`pb-2.5 font-semibold transition-colors border-b-2 -mb-px ${
                mode === 'register'
                  ? 'border-[#0a58ca] text-[#0a58ca]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Créer un Compte
            </button>
          </div>
        )}

        {authNotice && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 leading-relaxed">
            {authNotice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-1.5">
              <label htmlFor="auth-username" className="block text-xs font-semibold text-slate-700">
                Nom d&apos;utilisateur
              </label>
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 focus-within:border-[#0a58ca] focus-within:ring-2 focus-within:ring-[#0a58ca]/15 transition-all">
                <UserIcon className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  id="auth-username"
                  type="text"
                  required
                  minLength={3}
                  maxLength={32}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ex. Player216"
                  className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700">
              Adresse E-mail
            </label>
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 focus-within:border-[#0a58ca] focus-within:ring-2 focus-within:ring-[#0a58ca]/15 transition-all">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@exemple.com"
                className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {mode === 'reset-password' && resetStep === 'confirm' && (
            <>
              {issuedCode && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-slate-700 flex items-center justify-between">
                  <span>Code de vérification :</span>
                  <strong className="font-mono-tabular text-sm text-[#0a58ca]">{issuedCode}</strong>
                </div>
              )}
              <div className="space-y-1.5">
                <label htmlFor="auth-reset-code" className="block text-xs font-semibold text-slate-700">
                  Code de réinitialisation
                </label>
                <input
                  id="auth-reset-code"
                  type="text"
                  required
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="Code à 6 caractères"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono-tabular text-slate-900 placeholder-slate-400 focus:border-[#0a58ca] focus:outline-none"
                />
              </div>
            </>
          )}

          {(mode !== 'reset-password' || resetStep === 'confirm') && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700">
                  {mode === 'reset-password' ? 'Nouveau mot de passe' : 'Mot de Passe'}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => onNavigate('reset-password')}
                    className="text-xs font-medium text-[#0a58ca] hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 focus-within:border-[#0a58ca] focus-within:ring-2 focus-within:ring-[#0a58ca]/15 transition-all">
                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[#0a58ca] hover:bg-[#0847a8] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3 px-4 text-sm transition-colors min-h-[46px] shadow-xs"
          >
            {submitting
              ? 'Veuillez patienter...'
              : mode === 'login'
              ? 'Connexion'
              : mode === 'register'
              ? 'Créer mon Compte (0.00 DT)'
              : resetStep === 'request'
              ? 'Envoyer le code'
              : 'Confirmer le mot de passe'}
          </button>
        </form>

        {mode !== 'reset-password' && (
          <>
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-slate-200" />
              <span className="shrink mx-3 text-xs text-slate-400">ou</span>
              <div className="flex-grow border-t border-slate-200" />
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold py-2.5 px-4 text-sm transition-colors min-h-[44px]"
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
              <span>Continuer avec Google</span>
            </button>
          </>
        )}

        {mode === 'reset-password' && (
          <div className="pt-3 border-t border-slate-200 text-center text-xs text-slate-500">
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="text-[#0a58ca] hover:underline font-semibold"
            >
              Retour à la connexion
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
