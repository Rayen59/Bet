import React from 'react';
import { ChevronRight } from 'lucide-react';
import { MatchItem } from '../types/sportzone';
import { useSlip } from '../context/SlipContext';
import { TeamBadge } from './BrandLogo';

interface MatchRowProps {
  match: MatchItem;
  onSelectMatch: (matchId: number) => void;
}

export function MatchRow({ match, onSelectMatch }: MatchRowProps) {
  const { toggleSelection, isSelected, getMatchSelections } = useSlip();

  const primaryMarkets = React.useMemo(() => {
    if (match.sportSlug === 'football') {
      return match.markets
        .filter((m) => m.marketType === '1×2' || m.marketType === '1X2')
        .slice(0, 3);
    }
    return match.markets.filter((m) => m.marketType === 'Match Winner').slice(0, 2);
  }, [match.markets, match.sportSlug]);

  const matchPicks = getMatchSelections(match.id);
  const secondaryCount = Math.max(0, match.markets.length - primaryMarkets.length);
  const startDt = new Date(match.startTime);
  const formattedDate = startDt.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
  });
  const formattedTime = startDt.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const isFinished = match.status === 'finished';
  const isLive = match.status === 'live';

  return (
    <div className="group rounded-xl border border-slate-200 bg-white hover:border-[#0a58ca]/40 hover:shadow-sm p-4 sm:p-5 transition-all">
      {/* Top Meta Line */}
      <div className="flex items-center justify-between gap-2 mb-3.5 text-xs">
        <div className="flex items-center gap-2 min-w-0 truncate">
          {isLive ? (
            <>
              <span className="inline-flex items-center rounded bg-[#dc2626] px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-white uppercase shrink-0">
                LIVE
              </span>
              <span className="font-mono-tabular font-bold text-[#dc2626] whitespace-nowrap shrink-0">
                {match.matchTimer}
              </span>
            </>
          ) : (
            <span className="font-mono-tabular text-slate-600 font-semibold whitespace-nowrap shrink-0">
              {formattedDate} • {formattedTime}
            </span>
          )}

          <span className="text-slate-300">·</span>
          <span className="text-slate-600 font-medium truncate">
            {match.competitionCountry ? `${match.competitionCountry} · ` : ''}
            {match.competitionName}
          </span>

          {isFinished && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500 font-bold uppercase">Terminé</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onSelectMatch(match.id)}
            className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors leading-none ${
              matchPicks.length > 0
                ? 'bg-[#0a58ca] text-white'
                : 'bg-blue-50 text-[#0a58ca] border border-blue-200 hover:bg-blue-100'
            }`}
            title="Ouvrir Bet Builder"
          >
            {matchPicks.length > 1 ? `Bet Builder (${matchPicks.length})` : 'Bet Builder'}
          </button>

          <button
            type="button"
            onClick={() => onSelectMatch(match.id)}
            className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-500 hover:text-[#0a58ca] transition-colors whitespace-nowrap"
          >
            <span>{secondaryCount > 0 ? `+${secondaryCount} marchés` : 'Détails'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Matchup + Score + Spacious Light Odds Boxes */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => onSelectMatch(match.id)}
          className="flex-1 min-w-0 text-left flex items-center justify-between gap-4 rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a58ca]"
        >
          <div className="flex flex-col gap-3 min-w-0 flex-1">
            <div className="flex items-center gap-3 min-w-0">
              <TeamBadge shortName={match.homeTeam.shortName} color={match.homeTeam.logo} size="sm" />
              <span className="font-heading text-[15px] sm:text-base font-bold text-slate-900 truncate group-hover:text-[#0a58ca] transition-colors">
                {match.homeTeam.name}
              </span>
            </div>
            <div className="flex items-center gap-3 min-w-0">
              <TeamBadge shortName={match.awayTeam.shortName} color={match.awayTeam.logo} size="sm" />
              <span className="font-heading text-[15px] sm:text-base font-bold text-slate-900 truncate group-hover:text-[#0a58ca] transition-colors">
                {match.awayTeam.name}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end justify-center gap-3 shrink-0 pr-2">
            <span
              className={`font-mono-tabular text-base sm:text-lg font-extrabold min-w-[1.75rem] text-right leading-8 ${
                isLive ? 'text-[#0a58ca]' : isFinished ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              {match.status === 'upcoming' ? '–' : match.homeScore}
            </span>
            <span
              className={`font-mono-tabular text-base sm:text-lg font-extrabold min-w-[1.75rem] text-right leading-8 ${
                isLive ? 'text-[#0a58ca]' : isFinished ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              {match.status === 'upcoming' ? '–' : match.awayScore}
            </span>
          </div>
        </button>

        {/* Clear, Spacious Odds Buttons */}
        <div
          className={`grid gap-2.5 shrink-0 ${
            primaryMarkets.length === 3 ? 'grid-cols-3 md:w-[320px]' : 'grid-cols-2 md:w-[235px]'
          }`}
        >
          {primaryMarkets.map((mkt) => {
            const active = isSelected(mkt.id);
            return (
              <button
                key={mkt.id}
                type="button"
                disabled={isFinished}
                onClick={() =>
                  toggleSelection(
                    {
                      matchId: match.id,
                      marketId: mkt.id,
                      matchLabel: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
                      competitionName: match.competitionName,
                      marketType: mkt.marketType,
                      selectionName: mkt.selectionName,
                      simulatedOdds: mkt.simulatedOdds,
                      status: match.status,
                      startTime: match.startTime,
                    },
                    {
                      homeName: match.homeTeam.name,
                      awayName: match.awayTeam.name,
                    }
                  )
                }
                className={`flex flex-col items-center justify-center rounded-xl px-3 py-2.5 transition-all min-h-[54px] border ${
                  isFinished
                    ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                    : active
                    ? 'bg-[#0a58ca] border-[#0a58ca] text-white font-bold shadow-xs'
                    : 'bg-slate-100/90 hover:bg-blue-50 border-slate-200 hover:border-[#0a58ca]/40 text-slate-900'
                }`}
              >
                <span
                  className={`text-[11px] font-semibold truncate max-w-full ${
                    active ? 'text-blue-100' : 'text-slate-500'
                  }`}
                >
                  {mkt.selectionName}
                </span>
                <span className="font-mono-tabular text-sm font-extrabold mt-0.5">
                  {mkt.simulatedOdds.toFixed(2)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
