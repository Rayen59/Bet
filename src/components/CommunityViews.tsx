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
    <div className="space-y-6">
      <div className="border-b border-zinc-800 pb-4">
        <h1 className="font-display text-2xl font-bold text-white">Simulation Leaderboard</h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Top SPORTZONE accounts ranked by DT Virtual Balance and ticket accuracy
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-[#18181b] overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <div className="h-10 bg-zinc-900 rounded animate-pulse" />
            <div className="h-10 bg-zinc-900 rounded animate-pulse" />
            <div className="h-10 bg-zinc-900 rounded animate-pulse" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-[#141416] text-xs text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Rank</th>
                  <th className="px-4 py-3 font-medium">Player</th>
                  <th className="px-4 py-3 font-medium text-right">Slips</th>
                  <th className="px-4 py-3 font-medium text-right">Win Rate</th>
                  <th className="px-4 py-3 font-medium text-right">Balance (DT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {leaders.map((entry) => (
                  <tr key={entry.id} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="px-4 py-3 font-mono-tabular font-bold text-zinc-300">
                      {entry.rank <= 3 ? (
                        <span className="inline-flex items-center gap-1.5 text-[#f5b800]">
                          <Trophy className="w-3.5 h-3.5" />#{entry.rank}
                        </span>
                      ) : (
                        `#${entry.rank}`
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">{entry.username}</td>
                    <td className="px-4 py-3 font-mono-tabular text-right text-zinc-300">
                      {entry.totalBets}
                    </td>
                    <td className="px-4 py-3 font-mono-tabular text-right text-[#f5b800]">
                      {entry.winRate}%
                    </td>
                    <td className="px-4 py-3 font-mono-tabular font-bold text-right text-emerald-400">
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
      showToast('Please sign in to claim virtual simulation rewards.', 'info');
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
      showToast(`Claimed +${res.offer.rewardCredits.toFixed(2)} DT!`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Unable to claim virtual reward.', 'error');
    } finally {
      setClaimingCode(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-800 pb-4">
        <h1 className="font-display text-2xl font-bold text-white">Sports Bonus & Rewards</h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          All bonuses grant non-monetary DT simulation credits for SPORTZONE analytics only
        </p>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="h-48 rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse" />
          <div className="h-48 rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse" />
          <div className="h-48 rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map((offer) => (
            <div
              key={offer.code}
              className="rounded-xl border border-zinc-800 bg-[#18181b] p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="inline-flex items-center gap-1.5 text-[#f5b800] font-semibold">
                    <Gift className="w-3.5 h-3.5" />
                    {offer.cadence === 'daily' ? 'Daily Reward' : 'One-Time Reward'}
                  </span>
                  <span className="font-mono-tabular text-zinc-500">{offer.code}</span>
                </div>
                <h2 className="font-display text-lg font-bold text-white">{offer.title}</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">{offer.description}</p>
              </div>

              <div className="pt-3 border-t border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Virtual Bonus</span>
                  <span className="font-mono-tabular text-base font-bold text-emerald-400">
                    +{offer.rewardCredits.toFixed(2)} DT
                  </span>
                </div>

                {offer.claimed ? (
                  <div className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/20 py-2 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Claimed</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={claimingCode === offer.code}
                    onClick={() => handleClaim(offer.code)}
                    className="w-full rounded-lg bg-[#f5b800] hover:bg-[#fbbf24] disabled:bg-zinc-800 text-[#111111] font-bold py-2 px-4 text-xs transition-colors min-h-[38px]"
                  >
                    {claimingCode === offer.code ? 'Crediting...' : 'Claim DT Bonus'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-zinc-800 bg-[#18181b] p-4 flex items-center gap-3 text-xs text-zinc-400">
        <Award className="w-4 h-4 text-[#f5b800] shrink-0" />
        <span>
          Virtual DT credits cannot be exchanged for real money, goods, or services. They exist solely for sports simulation analytics.
        </span>
      </div>
    </div>
  );
}
