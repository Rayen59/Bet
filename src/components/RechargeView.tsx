import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ImagePlus,
  Mail,
  MessageCircle,
  Plus,
  Send,
  Shield,
  Smartphone,
  Ticket,
  Trash2,
  Upload,
  Wallet,
  X,
  XCircle,
  ZoomIn,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../lib/api';
import {
  AppRoute,
  ContactMessageItem,
  DepositRequestItem,
} from '../types/sportzone';
import {
  D17Logo,
  OoredooLogo,
  OperatorBadge,
  OrangeLogo,
  TunisieTelecomLogo,
} from './OperatorLogos';

interface RechargeViewProps {
  onNavigate: (route: AppRoute) => void;
}

type TicketOperator = 'Ooredoo' | 'Orange' | 'Tunisie Telecom';

interface AdminContactInfo {
  admin: { id: number; username: string; email: string };
  acceptedOperators: string[];
  ticketValueDt: number;
  minStakeDt: number;
}

async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossible de lire le fichier image.'));
    reader.onload = () => {
      const src = String(reader.result || '');
      const img = new Image();
      img.onerror = () => reject(new Error('Format image invalide. Choisissez une capture PNG ou JPG.'));
      img.onload = () => {
        const maxDim = 1080;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export function RechargeView({ onNavigate }: RechargeViewProps) {
  const { user, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [method, setMethod] = useState<'tickets' | 'D17'>('tickets');
  const [operator, setOperator] = useState<TicketOperator>('Ooredoo');
  const [ticketCodes, setTicketCodes] = useState<string[]>(['']);
  const [ticketNote, setTicketNote] = useState('');

  const [d17Amount, setD17Amount] = useState('10');
  const [d17Phone, setD17Phone] = useState('');
  const [d17Screenshot, setD17Screenshot] = useState<string | null>(null);
  const [d17Note, setD17Note] = useState('');
  const [compressingImg, setCompressingImg] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [myDeposits, setMyDeposits] = useState<DepositRequestItem[]>([]);
  const [loadingDeposits, setLoadingDeposits] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Real-time Contact Admin state
  const [adminInfo, setAdminInfo] = useState<AdminContactInfo | null>(null);
  const [messages, setMessages] = useState<ContactMessageItem[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const loadMyDeposits = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoadingDeposits(true);
    try {
      const res = await apiFetch<{ deposits: DepositRequestItem[] }>('/api/deposits/mine');
      setMyDeposits(res.deposits);
    } catch {
      // handled silently on background sync
    } finally {
      if (!silent) setLoadingDeposits(false);
    }
  }, [user]);

  const loadMessages = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiFetch<{ messages: ContactMessageItem[] }>('/api/contact/messages');
      setMessages(res.messages);
    } catch {
      // silent
    }
  }, [user]);

  useEffect(() => {
    apiFetch<AdminContactInfo>('/api/contact/info')
      .then(setAdminInfo)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    loadMyDeposits();
    loadMessages();

    const onDepositUpdate = (ev: Event) => {
      const detail = (ev as CustomEvent<{ userId?: number; status?: string; amount?: number }>).detail;
      if (detail?.userId === user.id) {
        if (detail.status === 'approved') {
          showToast(`Recharge acceptée ! +${Number(detail.amount || 0).toFixed(2)} DT crédités.`, 'success');
        } else if (detail.status === 'rejected') {
          showToast('Votre demande de recharge a été refusée par l’administrateur.', 'error');
        }
        loadMyDeposits(true);
        refreshProfile();
      }
    };

    const onBalanceUpdate = () => {
      loadMyDeposits(true);
    };

    const onMessageReceived = () => {
      loadMessages();
    };

    window.addEventListener('sportzone:deposit_updated', onDepositUpdate);
    window.addEventListener('sportzone:balance_updated', onBalanceUpdate);
    window.addEventListener('sportzone:message_received', onMessageReceived);

    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadMyDeposits(true);
        loadMessages();
      }
    }, 6_000);

    return () => {
      window.removeEventListener('sportzone:deposit_updated', onDepositUpdate);
      window.removeEventListener('sportzone:balance_updated', onBalanceUpdate);
      window.removeEventListener('sportzone:message_received', onMessageReceived);
      clearInterval(poll);
    };
  }, [user, loadMyDeposits, loadMessages, refreshProfile, showToast]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!user) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-[#18191d] p-8 sm:p-10 text-center space-y-4">
        <Wallet className="w-10 h-10 text-[#f5b800] mx-auto" />
        <h1 className="font-display text-2xl font-bold text-white uppercase">
          Recharger votre compte
        </h1>
        <p className="text-sm text-zinc-400 max-w-md mx-auto">
          Connectez-vous pour recharger par tickets (Ooredoo, Orange, Tunisie Telecom — 2 DT / ticket) ou par D17 avec capture d’écran.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <OoredooLogo className="h-8 w-auto" />
          <OrangeLogo className="h-8 w-auto" />
          <TunisieTelecomLogo className="h-8 w-auto" />
          <D17Logo className="h-8 w-auto" />
        </div>
        <div className="pt-2 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="px-5 py-2.5 rounded-lg bg-[#f5b800] hover:bg-[#fbbf24] text-[#111111] font-bold text-sm"
          >
            Se connecter
          </button>
          <button
            type="button"
            onClick={() => onNavigate('register')}
            className="px-5 py-2.5 rounded-lg border border-zinc-700 text-zinc-200 hover:text-white font-semibold text-sm"
          >
            Créer un compte
          </button>
        </div>
      </div>
    );
  }

  if (user.role === 'admin') {
    return (
      <div className="rounded-xl border border-[#f5b800]/40 bg-[#18191d] p-8 text-center space-y-4">
        <Shield className="w-10 h-10 text-[#f5b800] mx-auto" />
        <h1 className="font-display text-2xl font-bold text-white uppercase">
          Espace Administrateur
        </h1>
        <p className="text-sm text-zinc-400 max-w-md mx-auto">
          En tant qu’administrateur, vous validez en temps réel les dépôts (Tickets / D17) et répondez aux joueurs depuis la Console Admin.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('admin')}
          className="px-6 py-2.5 rounded-lg bg-[#f5b800] hover:bg-[#fbbf24] text-[#111111] font-bold text-sm"
        >
          Ouvrir la Console Admin
        </button>
      </div>
    );
  }

  const requiredDigitsHint = operator === 'Tunisie Telecom' ? '13 ou 14 chiffres' : '14 chiffres exacts';
  const isCodeValid = (code: string) =>
    operator === 'Tunisie Telecom' ? /^\d{13,14}$/.test(code) : /^\d{14}$/.test(code);

  const validCodesCount = ticketCodes.filter((c) => isCodeValid(c)).length;
  const ticketsTotalDt = ticketCodes.filter((c) => c.length > 0).length * 2;

  const handleSelectGalleryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressingImg(true);
    try {
      const dataUrl = await compressImageFile(file);
      setD17Screenshot(dataUrl);
      showToast('Capture d’écran ajoutée avec succès.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Impossible de charger l’image.', 'error');
    } finally {
      setCompressingImg(false);
    }
  };

  const handleSubmitTickets = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = ticketCodes.map((c) => c.replace(/\D/g, '')).filter(Boolean);
    if (cleaned.length === 0) {
      showToast('Veuillez saisir au moins un numéro de ticket.', 'error');
      return;
    }
    const invalid = cleaned.find((c) => !isCodeValid(c));
    if (invalid) {
      showToast(`Code invalide (${invalid}) pour ${operator} (${requiredDigitsHint}).`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/api/deposits', {
        method: 'POST',
        body: JSON.stringify({
          method: 'tickets',
          operator,
          ticketCodes: cleaned,
          note: ticketNote.trim() || undefined,
        }),
      });
      setTicketCodes(['']);
      setTicketNote('');
      await loadMyDeposits(true);
      showToast(
        `Demande envoyée (${cleaned.length} ticket(s) = ${(cleaned.length * 2).toFixed(2)} DT) · En cours de traitement.`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors de l’envoi des tickets.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitD17 = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(d17Amount);
    const cleanPhone = d17Phone.replace(/\D/g, '');
    if (!Number.isFinite(amountNum) || amountNum < 5) {
      showToast('Le montant minimum D17 est de 5.00 DT.', 'error');
      return;
    }
    if (!/^\d{8,15}$/.test(cleanPhone)) {
      showToast('Entrez un numéro de téléphone D17 valide (minimum 8 chiffres).', 'error');
      return;
    }
    if (!d17Screenshot) {
      showToast('Ajoutez la capture d’écran de l’opération D17 depuis votre galerie.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/api/deposits', {
        method: 'POST',
        body: JSON.stringify({
          method: 'D17',
          operator: 'D17',
          amount: amountNum,
          phoneNumber: cleanPhone,
          screenshotData: d17Screenshot,
          note: d17Note.trim() || undefined,
        }),
      });
      setD17Phone('');
      setD17Screenshot(null);
      setD17Note('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadMyDeposits(true);
      showToast(
        `Demande D17 de ${amountNum.toFixed(2)} DT envoyée à l’Admin · En cours de traitement.`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors de l’envoi D17.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const txt = chatInput.trim();
    if (!txt) return;
    setSendingMsg(true);
    try {
      await apiFetch('/api/contact/messages', {
        method: 'POST',
        body: JSON.stringify({ message: txt }),
      });
      setChatInput('');
      await loadMessages();
    } catch (err: any) {
      showToast(err?.message || 'Impossible d’envoyer le message.', 'error');
    } finally {
      setSendingMsg(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Wallet Banner */}
      <div className="rounded-xl border border-[#f5b800]/35 bg-gradient-to-r from-[#1c1a13] via-[#18191d] to-[#141519] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#f5b800]" />
            <h1 className="font-display text-xl sm:text-2xl font-extrabold uppercase text-white tracking-wide">
              Recharger mon compte
            </h1>
          </div>
          <p className="text-xs text-zinc-300">
            Mise minimum pour parier : <strong className="text-[#f5b800]">5.00 DT</strong> · Chaque ticket validé ajoute <strong className="text-emerald-400">2.00 DT</strong> au solde.
          </p>
        </div>

        <div className="rounded-lg border border-[#f5b800]/40 bg-[#111214] px-4 py-2.5 text-right">
          <span className="text-[11px] text-zinc-400 block">Solde actuel</span>
          <span className="font-mono-tabular text-lg font-extrabold text-[#f5b800]">
            {user.virtualBalance.toFixed(2)} DT
          </span>
        </div>
      </div>

      {/* Main Split: Recharge Form (left) + Live Admin Contact Chat (right) */}
      <div className="grid lg:grid-cols-[1.25fr_0.95fr] gap-5 items-start">
        {/* Left: Recharge Form */}
        <div className="rounded-xl border border-zinc-800 bg-[#18191d] overflow-hidden">
          {/* Method Switcher Tabs */}
          <div className="grid grid-cols-2 border-b border-zinc-800 bg-[#121316]">
            <button
              type="button"
              onClick={() => setMethod('tickets')}
              className={`py-3.5 px-4 flex items-center justify-center gap-2 font-heading text-xs sm:text-sm font-bold border-b-2 transition-colors ${
                method === 'tickets'
                  ? 'border-[#f5b800] bg-[#1d1c16] text-[#f5b800]'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              <Ticket className="w-4 h-4 shrink-0" />
              <span>Tickets (2 DT / ticket)</span>
            </button>
            <button
              type="button"
              onClick={() => setMethod('D17')}
              className={`py-3.5 px-4 flex items-center justify-center gap-2 font-heading text-xs sm:text-sm font-bold border-b-2 transition-colors ${
                method === 'D17'
                  ? 'border-[#f5b800] bg-[#1d1c16] text-[#f5b800]'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4 shrink-0" />
              <span>D17 + Capture d’écran</span>
            </button>
          </div>

          {method === 'tickets' ? (
            <form onSubmit={handleSubmitTickets} className="p-4 sm:p-5 space-y-4">
              {/* Operator Selection Cards with Custom Drawn Logos */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 block">
                  1. Choisissez votre opérateur
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(
                    [
                      { id: 'Ooredoo', sub: '14 chiffres · 2 DT/ticket', Logo: OoredooLogo },
                      { id: 'Orange', sub: '14 chiffres · 2 DT/ticket', Logo: OrangeLogo },
                      { id: 'Tunisie Telecom', sub: '13-14 chiffres · 2 DT/ticket', Logo: TunisieTelecomLogo },
                    ] as const
                  ).map((op) => {
                    const active = operator === op.id;
                    const LogoComp = op.Logo;
                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => setOperator(op.id)}
                        className={`rounded-xl border p-3 flex sm:flex-col items-center justify-between sm:justify-center gap-2.5 transition-all min-h-[72px] ${
                          active
                            ? 'border-[#f5b800] bg-[#f5b800]/10 ring-1 ring-[#f5b800]'
                            : 'border-zinc-800 bg-[#111215] hover:border-zinc-600'
                        }`}
                      >
                        <LogoComp className="h-9 w-auto shrink-0" />
                        <span className="text-[11px] font-medium text-zinc-400">{op.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ticket Numbers Inputs */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    2. Entrez les numéros de tickets ({requiredDigitsHint})
                  </label>
                  <span className="text-[11px] font-mono-tabular text-[#f5b800] font-bold">
                    1 ticket = 2.00 DT
                  </span>
                </div>

                <div className="space-y-2">
                  {ticketCodes.map((code, idx) => {
                    const valid = isCodeValid(code);
                    const minReq = operator === 'Tunisie Telecom' ? 13 : 14;
                    const remaining = Math.max(0, minReq - code.length);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={14}
                            value={code}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '').slice(0, 14);
                              setTicketCodes((prev) => prev.map((v, i) => (i === idx ? digits : v)));
                            }}
                            placeholder={`Numéro ticket ${operator} #${idx + 1} (${requiredDigitsHint})`}
                            className={`w-full rounded-lg border bg-[#111215] px-3.5 py-2.5 pr-24 font-mono-tabular text-sm text-white placeholder-zinc-500 focus:outline-none ${
                              valid
                                ? 'border-emerald-500/70 focus:border-emerald-400'
                                : 'border-zinc-700 focus:border-[#f5b800]'
                            }`}
                          />
                          <span
                            className={`absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono-tabular font-bold ${
                              valid
                                ? 'text-emerald-400'
                                : code.length > 0
                                ? 'text-amber-400'
                                : 'text-zinc-500'
                            }`}
                          >
                            {valid ? 'Valide ✓' : code.length > 0 ? `-${remaining}` : `${code.length}/${minReq}`}
                          </span>
                        </div>

                        {ticketCodes.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setTicketCodes((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="w-10 h-10 rounded-lg border border-zinc-700 hover:border-rose-500 text-zinc-400 hover:text-rose-400 flex items-center justify-center shrink-0"
                            aria-label="Supprimer ce ticket"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {ticketCodes.length < 25 && (
                  <button
                    type="button"
                    onClick={() => setTicketCodes((prev) => [...prev, ''])}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-700 hover:border-[#f5b800] px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:text-[#f5b800] transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter un autre ticket (+2.00 DT)</span>
                  </button>
                )}
              </div>

              <input
                type="text"
                value={ticketNote}
                onChange={(e) => setTicketNote(e.target.value)}
                placeholder="Remarque optionnelle pour l’Admin..."
                className="w-full rounded-lg border border-zinc-800 bg-[#111215] px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-[#f5b800] focus:outline-none"
              />

              {/* Total Calculation Bar */}
              <div className="rounded-lg border border-zinc-800 bg-[#111215] p-3.5 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <span className="text-zinc-400 block">Montant crédité après validation Admin</span>
                  <span className="font-semibold text-zinc-200">
                    {validCodesCount} ticket(s) valide(s) × 2.00 DT
                  </span>
                </div>
                <span className="font-mono-tabular text-lg font-extrabold text-[#f5b800]">
                  +{ticketsTotalDt.toFixed(2)} DT
                </span>
              </div>

              <button
                type="submit"
                disabled={submitting || validCodesCount === 0}
                className="w-full h-11 rounded-lg bg-[#f5b800] hover:bg-[#fbbf24] disabled:bg-zinc-800 disabled:text-zinc-500 text-[#111111] font-heading font-extrabold uppercase text-xs sm:text-sm tracking-wide transition-colors"
              >
                {submitting ? 'Envoi en cours...' : `Envoyer la recharge (${ticketsTotalDt.toFixed(2)} DT)`}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmitD17} className="p-4 sm:p-5 space-y-4">
              {/* D17 Primary Logo Header */}
              <div className="rounded-xl border border-blue-500/30 bg-[#101626] p-3.5 flex items-center justify-between gap-3">
                <D17Logo className="h-10 w-auto shrink-0" />
                <div className="text-right text-xs">
                  <p className="font-bold text-white">Paiement D17 · Poste Tunisienne</p>
                  <p className="text-zinc-400">Minimum 5.00 DT · Validation en temps réel</p>
                </div>
              </div>

              {/* Amount Presets */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 block">
                  1. Montant envoyé via D17 (min 5 DT)
                </label>
                <div className="flex flex-wrap gap-2">
                  {[5, 10, 20, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setD17Amount(String(amt))}
                      className={`px-3.5 py-2 rounded-lg border font-mono-tabular text-xs font-bold transition-colors ${
                        Number(d17Amount) === amt
                          ? 'border-[#f5b800] bg-[#f5b800]/20 text-[#f5b800]'
                          : 'border-zinc-800 bg-[#111215] text-zinc-300 hover:border-zinc-600'
                      }`}
                    >
                      {amt} DT
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={5}
                  step="1"
                  required
                  value={d17Amount}
                  onChange={(e) => setD17Amount(e.target.value)}
                  placeholder="Montant en DT (min 5)"
                  className="w-full rounded-lg border border-zinc-700 bg-[#111215] px-3.5 py-2.5 font-mono-tabular text-sm text-white focus:border-[#f5b800] focus:outline-none"
                />
              </div>

              {/* D17 Phone Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 block">
                  2. Votre numéro D17 / Téléphone
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  required
                  value={d17Phone}
                  onChange={(e) => setD17Phone(e.target.value.replace(/[^\d\s+]/g, ''))}
                  placeholder="Ex: 55 123 456"
                  className="w-full rounded-lg border border-zinc-700 bg-[#111215] px-3.5 py-2.5 font-mono-tabular text-sm text-white placeholder-zinc-500 focus:border-[#f5b800] focus:outline-none"
                />
              </div>

              {/* Screenshot Upload from Gallery */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 block">
                  3. Capture d’écran de l’opération D17 (Galerie)
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSelectGalleryFile}
                  className="hidden"
                />

                {!d17Screenshot ? (
                  <button
                    type="button"
                    disabled={compressingImg}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-xl border-2 border-dashed border-zinc-700 hover:border-[#f5b800] bg-[#111215] p-6 flex flex-col items-center justify-center gap-2 text-center transition-colors"
                  >
                    <ImagePlus className="w-8 h-8 text-[#f5b800]" />
                    <span className="text-xs font-bold text-white">
                      {compressingImg
                        ? 'Préparation de l’image...'
                        : 'Choisir une capture d’écran depuis la galerie'}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      L’Admin reçoit automatiquement votre capture pour accepter ou refuser
                    </span>
                  </button>
                ) : (
                  <div className="rounded-xl border border-emerald-500/40 bg-[#111215] p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={d17Screenshot}
                        alt="Capture D17"
                        onClick={() => setPreviewImage(d17Screenshot)}
                        className="w-16 h-16 rounded-lg object-cover border border-zinc-700 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-emerald-400">Capture prête ✓</p>
                        <p className="text-[11px] text-zinc-400 truncate">
                          Sera envoyée à l’Admin en temps réel
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-lg border border-zinc-700 hover:border-[#f5b800] px-2.5 py-1.5 text-xs text-zinc-200 inline-flex items-center gap-1"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Changer</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setD17Screenshot(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="rounded-lg border border-zinc-700 hover:border-rose-500 p-1.5 text-zinc-400 hover:text-rose-400"
                        aria-label="Retirer l'image"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <input
                type="text"
                value={d17Note}
                onChange={(e) => setD17Note(e.target.value)}
                placeholder="Message / ID transaction optionnel..."
                className="w-full rounded-lg border border-zinc-800 bg-[#111215] px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-[#f5b800] focus:outline-none"
              />

              <button
                type="submit"
                disabled={submitting || compressingImg || !d17Screenshot}
                className="w-full h-11 rounded-lg bg-[#f5b800] hover:bg-[#fbbf24] disabled:bg-zinc-800 disabled:text-zinc-500 text-[#111111] font-heading font-extrabold uppercase text-xs sm:text-sm tracking-wide transition-colors"
              >
                {submitting ? 'Envoi en cours...' : `Envoyer demande D17 (${Number(d17Amount || 0).toFixed(2)} DT)`}
              </button>
            </form>
          )}
        </div>

        {/* Right: Contact Admin in Real Time */}
        <div className="rounded-xl border border-zinc-800 bg-[#18191d] overflow-hidden flex flex-col">
          <div className="px-4 py-3.5 border-b border-zinc-800 bg-[#121316] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-[#f5b800]" />
              <h2 className="font-heading text-sm font-bold text-white uppercase">
                Contacter l’Admin (Temps Réel)
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-emerald-400">En ligne</span>
          </div>

          {adminInfo && (
            <div className="px-4 py-3 border-b border-zinc-800/80 bg-[#141519] flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Shield className="w-4 h-4 text-[#f5b800] shrink-0" />
                <span className="font-bold text-white truncate">{adminInfo.admin.username}</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-zinc-300 font-mono-tabular truncate">
                <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                {adminInfo.admin.email}
              </span>
            </div>
          )}

          <div className="p-3.5 space-y-2.5 h-72 overflow-y-auto bg-[#111215]">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-1.5">
                <MessageCircle className="w-7 h-7 text-zinc-600" />
                <p className="text-xs font-semibold text-zinc-300">
                  Besoin d’envoyer de l’argent ou vérifier un dépôt ?
                </p>
                <p className="text-[11px] text-zinc-500">
                  Écrivez directement à l’administrateur ici, il reçoit vos messages instantanément.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMine = msg.senderRole !== 'admin';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3.5 py-2 text-xs space-y-1 ${
                        isMine
                          ? 'bg-[#f5b800] text-[#111111] font-medium'
                          : 'bg-[#1f2127] border border-zinc-700 text-zinc-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-[10px] opacity-75 font-bold">
                        <span>{isMine ? 'Vous' : `${msg.senderName} (Admin)`}</span>
                        <span className="font-mono-tabular">
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.message}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          <form
            onSubmit={handleSendMessage}
            className="p-3 border-t border-zinc-800 bg-[#141519] flex items-center gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Message à l’Admin (ex: numéro D17, question...)..."
              className="flex-1 rounded-lg border border-zinc-700 bg-[#111215] px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-[#f5b800] focus:outline-none"
            />
            <button
              type="submit"
              disabled={sendingMsg || !chatInput.trim()}
              className="h-9 px-3.5 rounded-lg bg-[#f5b800] hover:bg-[#fbbf24] disabled:bg-zinc-800 disabled:text-zinc-500 text-[#111111] font-bold text-xs inline-flex items-center gap-1.5 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Envoyer</span>
            </button>
          </form>
        </div>
      </div>

      {/* Live Status Tracker: Mes demandes de recharge */}
      <div className="rounded-xl border border-zinc-800 bg-[#18191d] overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 bg-[#121316] flex items-center justify-between gap-2">
          <h2 className="font-heading text-sm font-bold text-white uppercase">
            Mes demandes de recharge (Temps Réel)
          </h2>
          <span className="text-xs font-mono-tabular text-zinc-400">
            {myDeposits.length} demande(s)
          </span>
        </div>

        {loadingDeposits ? (
          <div className="p-6 space-y-2.5">
            <div className="h-16 rounded-lg bg-zinc-900 animate-pulse" />
            <div className="h-16 rounded-lg bg-zinc-900 animate-pulse" />
          </div>
        ) : myDeposits.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400">
            Aucune demande envoyée pour le moment. Choisissez Tickets ou D17 ci-dessus pour recharger votre compte.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/80">
            {myDeposits.map((dep) => {
              const isPending = dep.status === 'pending';
              const isApproved = dep.status === 'approved';
              return (
                <div
                  key={dep.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <OperatorBadge operator={dep.operator} size="sm" />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-white">{dep.operator}</span>
                        <span className="font-mono-tabular font-extrabold text-[#f5b800]">
                          +{dep.amount.toFixed(2)} DT
                        </span>
                        <span className="text-[11px] font-mono-tabular text-zinc-500">
                          {new Date(dep.createdAt).toLocaleString()}
                        </span>
                      </div>

                      {dep.method === 'tickets' && dep.ticketCodes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {dep.ticketCodes.map((code, idx) => (
                            <span
                              key={idx}
                              className="rounded bg-[#111215] border border-zinc-800 px-2 py-0.5 font-mono-tabular text-[11px] text-zinc-200"
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      )}

                      {dep.method === 'D17' && dep.phoneNumber && (
                        <p className="text-[11px] text-zinc-300 font-mono-tabular">
                          Tél D17 : <strong className="text-white">{dep.phoneNumber}</strong>
                        </p>
                      )}

                      {dep.adminNote && (
                        <p className="text-[11px] text-zinc-400 italic">
                          Note Admin : {dep.adminNote}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    {dep.screenshotData && (
                      <button
                        type="button"
                        onClick={() => setPreviewImage(dep.screenshotData!)}
                        className="relative group rounded-lg overflow-hidden border border-zinc-700 w-12 h-12 shrink-0"
                        title="Voir la capture D17"
                      >
                        <img
                          src={dep.screenshotData}
                          alt="Reçu D17"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <ZoomIn className="w-4 h-4 text-white" />
                        </span>
                      </button>
                    )}

                    {isPending ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-500/35 px-3 py-1.5 text-xs font-bold text-amber-300">
                        <Clock className="w-3.5 h-3.5 animate-pulse" />
                        <span>En cours de traitement</span>
                      </span>
                    ) : isApproved ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/35 px-3 py-1.5 text-xs font-bold text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Accepté</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/15 border border-rose-500/35 px-3 py-1.5 text-xs font-bold text-rose-400">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Refusé</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Screenshot Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-lg w-full rounded-xl bg-[#18191d] border border-zinc-700 p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-[#f5b800] text-[#111111] flex items-center justify-center shadow-lg font-bold"
              aria-label="Fermer l'aperçu"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={previewImage}
              alt="Capture D17"
              className="w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
