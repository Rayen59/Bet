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
      // silent
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
      <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-10 text-center space-y-4 shadow-xs">
        <Wallet className="w-10 h-10 text-[#0a58ca] mx-auto" />
        <h1 className="font-heading text-2xl font-extrabold text-slate-900">
          Recharger votre compte
        </h1>
        <p className="text-sm font-semibold text-slate-600 max-w-md mx-auto">
          Connectez-vous pour recharger par tickets (Ooredoo, Orange, Tunisie Telecom — <strong className="text-slate-900">1.200 DT / ticket</strong>) ou par D17 avec capture d’écran.
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
            className="px-5 py-2.5 rounded-xl bg-[#0a58ca] hover:bg-[#0847a8] text-white font-bold text-sm"
          >
            Se connecter
          </button>
          <button
            type="button"
            onClick={() => onNavigate('register')}
            className="px-5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100 font-semibold text-sm"
          >
            Créer un compte
          </button>
        </div>
      </div>
    );
  }

  if (user.role === 'admin') {
    return (
      <div className="rounded-2xl border border-blue-200 bg-white p-8 text-center space-y-4 shadow-xs">
        <Shield className="w-10 h-10 text-[#0a58ca] mx-auto" />
        <h1 className="font-heading text-2xl font-extrabold text-slate-900">
          Espace Administrateur
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          En tant qu’administrateur, vous validez en temps réel les dépôts (Tickets / D17) et répondez aux joueurs depuis la Console Admin.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('admin')}
          className="px-6 py-2.5 rounded-xl bg-[#0a58ca] hover:bg-[#0847a8] text-white font-bold text-sm"
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
  const ticketsTotalDt = Math.round(validCodesCount * 1.2 * 1000) / 1000;

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
        `Demande envoyée (${cleaned.length} ticket(s) = ${(cleaned.length * 1.2).toFixed(3)} DT) · En cours de traitement.`,
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
      <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#0a58ca]" />
            <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-slate-900">
              Recharger mon compte
            </h1>
          </div>
          <p className="text-xs font-bold text-slate-600">
            Mise minimum pour parier : <strong className="text-[#1472e5]">5.00 DT</strong> · Chaque ticket validé ajoute <strong className="text-emerald-600">1.200 DT</strong> au solde.
          </p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-right">
          <span className="text-[11px] text-slate-600 font-bold block">Solde actuel</span>
          <span className="font-mono-tabular text-lg font-black text-[#091b35]">
            {user.virtualBalance.toFixed(2)} DT
          </span>
        </div>
      </div>

      {/* Main Split: Recharge Form (left) + Live Admin Contact Chat (right) */}
      <div className="grid lg:grid-cols-[1.25fr_0.95fr] gap-5 items-start">
        <div className="rounded-2xl border border-slate-300 bg-white overflow-hidden shadow-xs">
          {/* Method Switcher Tabs */}
          <div className="grid grid-cols-2 border-b border-slate-200 bg-[#091b35]">
            <button
              type="button"
              onClick={() => setMethod('tickets')}
              className={`py-3.5 px-4 flex items-center justify-center gap-2 font-heading text-xs sm:text-sm font-black border-b-2 transition-colors ${
                method === 'tickets'
                  ? 'border-[#facc15] bg-[#143568] text-white'
                  : 'border-transparent text-slate-300 hover:text-white'
              }`}
            >
              <Ticket className="w-4 h-4 shrink-0 text-[#facc15]" />
              <span>Tickets (1.200 DT / ticket)</span>
            </button>
            <button
              type="button"
              onClick={() => setMethod('D17')}
              className={`py-3.5 px-4 flex items-center justify-center gap-2 font-heading text-xs sm:text-sm font-black border-b-2 transition-colors ${
                method === 'D17'
                  ? 'border-[#facc15] bg-[#143568] text-white'
                  : 'border-transparent text-slate-300 hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4 shrink-0 text-[#38bdf8]" />
              <span>D17 + Capture d’écran</span>
            </button>
          </div>

          {method === 'tickets' ? (
            <form onSubmit={handleSubmitTickets} className="p-4 sm:p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 block">
                  1. Choisissez votre opérateur
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(
                    [
                      { id: 'Ooredoo', sub: '14 chiffres · 1.200 DT/ticket', Logo: OoredooLogo },
                      { id: 'Orange', sub: '14 chiffres · 1.200 DT/ticket', Logo: OrangeLogo },
                      { id: 'Tunisie Telecom', sub: '13-14 chiffres · 1.200 DT/ticket', Logo: TunisieTelecomLogo },
                    ] as const
                  ).map((op) => {
                    const active = operator === op.id;
                    const LogoComp = op.Logo;
                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => setOperator(op.id)}
                        className={`rounded-xl border-2 p-3 flex sm:flex-col items-center justify-between sm:justify-center gap-2.5 transition-all min-h-[78px] ${
                          active
                            ? 'border-[#1472e5] bg-blue-50/80 shadow-xs'
                            : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <LogoComp className="h-9 w-auto shrink-0" />
                        <span className="text-[11px] font-extrabold text-slate-700">{op.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    2. Entrez les numéros de tickets ({requiredDigitsHint})
                  </label>
                  <span className="text-[11px] font-mono-tabular text-[#1472e5] font-black">
                    1 ticket = 1.200 DT
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
                            className={`w-full rounded-xl border bg-white px-3.5 py-2.5 pr-24 font-mono-tabular text-sm text-slate-900 placeholder-slate-400 focus:outline-none ${
                              valid
                                ? 'border-emerald-500 focus:border-emerald-600'
                                : 'border-slate-300 focus:border-[#0a58ca]'
                            }`}
                          />
                          <span
                            className={`absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono-tabular font-bold ${
                              valid
                                ? 'text-emerald-600'
                                : code.length > 0
                                ? 'text-amber-600'
                                : 'text-slate-400'
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
                            className="w-10 h-10 rounded-xl border border-slate-300 hover:border-rose-500 text-slate-400 hover:text-rose-600 flex items-center justify-center shrink-0"
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
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 hover:border-[#1472e5] px-3.5 py-2 text-xs font-extrabold text-slate-700 hover:text-[#1472e5] transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter un autre ticket (+1.200 DT)</span>
                  </button>
                )}
              </div>

              <input
                type="text"
                value={ticketNote}
                onChange={(e) => setTicketNote(e.target.value)}
                placeholder="Remarque optionnelle pour l’Admin..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder-slate-400 focus:border-[#1472e5] focus:outline-none"
              />

              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <span className="text-slate-600 font-bold block">Montant crédité après validation Admin</span>
                  <span className="font-extrabold text-slate-950">
                    {validCodesCount} ticket(s) valide(s) × 1.200 DT
                  </span>
                </div>
                <span className="font-mono-tabular text-lg font-black text-[#1472e5]">
                  +{ticketsTotalDt.toFixed(3)} DT
                </span>
              </div>

              <button
                type="submit"
                disabled={submitting || validCodesCount === 0}
                className="w-full h-11 rounded-xl bg-[#16a34a] hover:bg-[#15803d] disabled:bg-slate-200 disabled:text-slate-400 text-white font-heading font-black uppercase text-xs sm:text-sm tracking-wide transition-colors"
              >
                {submitting ? 'Envoi en cours...' : `Envoyer la recharge (${ticketsTotalDt.toFixed(3)} DT)`}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmitD17} className="p-4 sm:p-5 space-y-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 flex items-center justify-between gap-3">
                <D17Logo className="h-10 w-auto shrink-0" />
                <div className="text-right text-xs">
                  <p className="font-bold text-slate-900">Paiement D17 · Poste Tunisienne</p>
                  <p className="text-slate-600">Minimum 5.00 DT · Validation en temps réel</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                  1. Montant envoyé via D17 (min 5 DT)
                </label>
                <div className="flex flex-wrap gap-2">
                  {[5, 10, 20, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setD17Amount(String(amt))}
                      className={`px-3.5 py-2 rounded-xl border font-mono-tabular text-xs font-bold transition-colors ${
                        Number(d17Amount) === amt
                          ? 'border-[#0a58ca] bg-[#0a58ca] text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
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
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono-tabular text-sm text-slate-900 focus:border-[#0a58ca] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                  2. Votre numéro D17 / Téléphone
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  required
                  value={d17Phone}
                  onChange={(e) => setD17Phone(e.target.value.replace(/[^\d\s+]/g, ''))}
                  placeholder="Ex: 55 123 456"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono-tabular text-sm text-slate-900 placeholder-slate-400 focus:border-[#0a58ca] focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
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
                    className="w-full rounded-xl border-2 border-dashed border-slate-300 hover:border-[#0a58ca] bg-slate-50 p-6 flex flex-col items-center justify-center gap-2 text-center transition-colors"
                  >
                    <ImagePlus className="w-8 h-8 text-[#0a58ca]" />
                    <span className="text-xs font-bold text-slate-800">
                      {compressingImg
                        ? 'Préparation de l’image...'
                        : 'Choisir une capture d’écran depuis la galerie'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      L’Admin reçoit automatiquement votre capture pour accepter ou refuser
                    </span>
                  </button>
                ) : (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={d17Screenshot}
                        alt="Capture D17"
                        onClick={() => setPreviewImage(d17Screenshot)}
                        className="w-16 h-16 rounded-lg object-cover border border-slate-200 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-emerald-700">Capture prête ✓</p>
                        <p className="text-[11px] text-slate-600 truncate">
                          Sera envoyée à l’Admin en temps réel
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-lg border border-slate-300 bg-white hover:border-[#0a58ca] px-2.5 py-1.5 text-xs text-slate-700 inline-flex items-center gap-1"
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
                        className="rounded-lg border border-slate-300 bg-white hover:border-rose-500 p-1.5 text-slate-500 hover:text-rose-600"
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
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-[#0a58ca] focus:outline-none"
              />

              <button
                type="submit"
                disabled={submitting || compressingImg || !d17Screenshot}
                className="w-full h-11 rounded-xl bg-[#059669] hover:bg-[#047857] disabled:bg-slate-200 disabled:text-slate-400 text-white font-heading font-extrabold uppercase text-xs sm:text-sm tracking-wide transition-colors"
              >
                {submitting ? 'Envoi en cours...' : `Envoyer demande D17 (${Number(d17Amount || 0).toFixed(2)} DT)`}
              </button>
            </form>
          )}
        </div>

        {/* Right: Contact Admin in Real Time */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col shadow-xs">
          <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-[#0a58ca]" />
              <h2 className="font-heading text-sm font-extrabold text-slate-900">
                Contacter l’Admin (Temps Réel)
              </h2>
            </div>
            <span className="text-[11px] font-bold text-emerald-600">En ligne</span>
          </div>

          {adminInfo && (
            <div className="px-4 py-2.5 border-b border-slate-100 bg-blue-50/50 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Shield className="w-4 h-4 text-[#0a58ca] shrink-0" />
                <span className="font-bold text-slate-900 truncate">{adminInfo.admin.username}</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-slate-600 font-mono-tabular truncate">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {adminInfo.admin.email}
              </span>
            </div>
          )}

          <div className="p-3.5 space-y-2.5 h-72 overflow-y-auto bg-[#f8fafc]">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-1.5">
                <MessageCircle className="w-7 h-7 text-slate-300" />
                <p className="text-xs font-bold text-slate-700">
                  Besoin d’envoyer de l’argent ou vérifier un dépôt ?
                </p>
                <p className="text-[11px] text-slate-500">
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
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs space-y-1 shadow-2xs ${
                        isMine
                          ? 'bg-[#0a58ca] text-white font-medium'
                          : 'bg-white border border-slate-200 text-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-[10px] opacity-80 font-bold">
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
            className="p-3 border-t border-slate-100 bg-white flex items-center gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Message à l’Admin (ex: numéro D17, question...)..."
              className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-[#0a58ca] focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={sendingMsg || !chatInput.trim()}
              className="h-9 px-3.5 rounded-xl bg-[#0a58ca] hover:bg-[#0847a8] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs inline-flex items-center gap-1.5 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Envoyer</span>
            </button>
          </form>
        </div>
      </div>

      {/* Live Status Tracker */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
          <h2 className="font-heading text-sm font-extrabold text-slate-900">
            Mes demandes de recharge (Temps Réel)
          </h2>
          <span className="text-xs font-mono-tabular text-slate-500">
            {myDeposits.length} demande(s)
          </span>
        </div>

        {loadingDeposits ? (
          <div className="p-6 space-y-2.5">
            <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
          </div>
        ) : myDeposits.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Aucune demande envoyée pour le moment. Choisissez Tickets ou D17 ci-dessus pour recharger votre compte.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
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
                        <span className="font-bold text-slate-900">{dep.operator}</span>
                        <span className="font-mono-tabular font-black text-[#1472e5]">
                          +{dep.method === 'tickets' ? dep.amount.toFixed(3) : dep.amount.toFixed(2)} DT
                        </span>
                        <span className="text-[11px] font-mono-tabular text-slate-400">
                          {new Date(dep.createdAt).toLocaleString()}
                        </span>
                      </div>

                      {dep.method === 'tickets' && dep.ticketCodes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {dep.ticketCodes.map((code, idx) => (
                            <span
                              key={idx}
                              className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-0.5 font-mono-tabular text-[11px] text-slate-800"
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      )}

                      {dep.method === 'D17' && dep.phoneNumber && (
                        <p className="text-[11px] text-slate-600 font-mono-tabular">
                          Tél D17 : <strong className="text-slate-900">{dep.phoneNumber}</strong>
                        </p>
                      )}

                      {dep.adminNote && (
                        <p className="text-[11px] text-slate-500 italic">
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
                        className="relative group rounded-xl overflow-hidden border border-slate-200 w-12 h-12 shrink-0"
                        title="Voir la capture D17"
                      >
                        <img
                          src={dep.screenshotData}
                          alt="Reçu D17"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <ZoomIn className="w-4 h-4 text-white" />
                        </span>
                      </button>
                    )}

                    {isPending ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-800">
                        <Clock className="w-3.5 h-3.5" />
                        <span>En cours</span>
                      </span>
                    ) : isApproved ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Accepté</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-100 border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700">
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
          className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-lg w-full rounded-2xl bg-white border border-slate-200 p-2 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-[#0a58ca] text-white flex items-center justify-center shadow-lg font-bold"
              aria-label="Fermer l'aperçu"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={previewImage}
              alt="Capture D17"
              className="w-full max-h-[80vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
