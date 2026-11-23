import React, { useCallback, useEffect, useState } from 'react';
import { Award, CheckCircle2, Gift, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../lib/api';
import { AppRoute, LeaderboardEntry, PromoOffer } from '../types/sportzone';

export function LeaderboardView() {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ leaderboard: LeaderboardEntry[] }>('/api/leaderboard')
      .then((res) => setLeaders(res.leaderboard))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[#0a58ca]" />
          <span>Classement des Joueurs</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Top des comptes SPORTZONE classés par solde virtuel (DT) et taux de réussite
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-6 space-y-3">
            <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Rang</th>
                  <th className="px-4 py-3">Joueur</th>
                  <th className="px-4 py-3 text-right">Tickets</th>
                  <th className="px-4 py-3 text-right">Réussite</th>
                  <th className="px-4 py-3 text-right">Solde (DT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaders.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5 font-mono-tabular font-bold text-slate-700">
                      {entry.rank <= 3 ? (
                        <span className="inline-flex items-center gap-1.5 text-[#0a58ca]">
                          <Trophy className="w-4 h-4" />#{entry.rank}
                        </span>
                      ) : (
                        `#${entry.rank}`
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-900">{entry.username}</td>
                    <td className="px-4 py-3.5 font-mono-tabular text-right text-slate-600">
                      {entry.totalBets}
                    </td>
                    <td className="px-4 py-3.5 font-mono-tabular text-right font-semibold text-[#0a58ca]">
                      {entry.winRate}%
                    </td>
                    <td className="px-4 py-3.5 font-mono-tabular font-extrabold text-right text-emerald-600">
                      {entry.virtualBalance.toFixed(2)} DT
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function PromotionsView({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  const { user, updateLocalBalance, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [offers, setOffers] = useState<PromoOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingCode, setClaimingCode] = useState<string | null>(null);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ promotions: PromoOffer[] }>('/api/promotions');
      setOffers(res.promotions);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOffers();
  }, [loadOffers, user]);

  const handleClaim = async (code: string) => {
    if (!user) {
      showToast('Veuillez vous connecter pour réclamer vos bonus.', 'info');
      onNavigate('login');
      return;
    }
    setClaimingCode(code);
    try {
      const res = await apiFetch<{ updatedBalance: number; offer: PromoOffer }>(
        '/api/promotions/claim',
        {
          method: 'POST',
          body: JSON.stringify({ code }),
        }
      );
      updateLocalBalance(res.updatedBalance);
      await refreshProfile();
      await loadOffers();
      showToast(`Bonus crédité : +${res.offer.rewardCredits.toFixed(2)} DT !`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Impossible de réclamer ce bonus.', 'error');
    } finally {
      setClaimingCode(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Gift className="w-5 h-5 text-[#0a58ca]" />
          <span>Bonus Sports &amp; Récompenses</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Tous les bonus attribuent des crédits virtuels DT sur votre portefeuille SPORTZONE
        </p>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="h-48 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          <div className="h-48 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          <div className="h-48 rounded-2xl bg-white border border-slate-200 animate-pulse" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map((offer) => (
            <div
              key={offer.code}
              className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4 shadow-xs"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5 text-[#0a58ca] font-bold">
                    <Gift className="w-3.5 h-3.5" />
                    {offer.cadence === 'daily' ? 'Bonus Quotidien' : 'Offre Unique'}
                  </span>
                  <span className="font-mono-tabular text-slate-400">{offer.code}</span>
                </div>
                <h2 className="font-heading text-base font-extrabold text-slate-900">
                  {offer.title}
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">{offer.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Bonus virtuel</span>
                  <span className="font-mono-tabular text-base font-extrabold text-emerald-600">
                    +{offer.rewardCredits.toFixed(2)} DT
                  </span>
                </div>

                {offer.claimed ? (
                  <div className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 py-2 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Réclamé</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={claimingCode === offer.code}
                    onClick={() => handleClaim(offer.code)}
                    className="w-full rounded-xl bg-[#059669] hover:bg-[#047857] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-2.5 px-4 text-xs transition-colors min-h-[40px]"
                  >
                    {claimingCode === offer.code ? 'Activation...' : 'Réclamer le Bonus'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 flex items-center gap-3 text-xs text-slate-700">
        <Award className="w-4 h-4 text-[#0a58ca] shrink-0" />
        <span>
          Les crédits virtuels DT servent uniquement aux paris sportifs simulés et à l&apos;analyse des matchs sur SPORTZONE.
        </span>
      </div>
    </div>
  );
}
