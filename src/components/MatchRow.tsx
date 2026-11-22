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
  const { toggleSelection, isSelected } = useSlip();

  const primaryMarkets = React.useMemo(() => {
    if (match.sportSlug === 'football') {
      return match.markets.filter((m) => m.marketType === '1×2' || m.marketType === '1X2').slice(0, 3);
    }
    return match.markets.filter((m) => m.marketType === 'Match Winner').slice(0, 2);
  }, [match.markets, match.sportSlug]);

  const secondaryCount = Math.max(0, match.markets.length - primaryMarkets.length);
  const startDt = new Date(match.startTime);
  const formattedDate = startDt.toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
  });
  const formattedTime = startDt.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const isFinished = match.status === 'finished';

  return (
    <div className="group border-b border-zinc-800/80 last:border-b-0 bg-[#17171a] hover:bg-[#1e1e22] px-3.5 py-3 transition-colors">
      {/* Top Meta Line */}
      <div className="flex items-center justify-between gap-2 mb-2 text-[11px] text-zinc-400">
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          {match.status === 'live' ? (
            <>
              <span className="inline-flex items-center rounded-xs bg-[#dc2626] px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-white uppercase shrink-0">
                LIVE
              </span>
              <span className="font-mono-tabular font-bold text-white whitespace-nowrap shrink-0">
                {match.matchTimer}
              </span>
            </>
          ) : (
            <span className="font-mono-tabular text-zinc-300 font-medium whitespace-nowrap shrink-0">
              {formattedTime} {formattedDate}
            </span>
          )}
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-300 font-medium truncate">
            {match.competitionCountry ? `${match.competitionCountry} · ` : ''}
            {match.competitionName}
          </span>
          {isFinished && (
            <>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-500 font-bold uppercase">FT</span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => onSelectMatch(match.id)}
          className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-zinc-400 hover:text-[#f5b800] transition-colors whitespace-nowrap shrink-0"
        >
          <span>{secondaryCount > 0 ? `+${secondaryCount}` : 'Stats'}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Matchup + Score + Crisp Light Odds Boxes */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <button
          type="button"
          onClick={() => onSelectMatch(match.id)}
          className="flex-1 min-w-0 text-left flex items-center justify-between gap-3 rounded py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5b800]"
        >
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <TeamBadge shortName={match.homeTeam.shortName} color={match.homeTeam.logo} size="sm" />
              <span className="font-heading text-[14px] font-semibold text-white truncate">
                {match.homeTeam.name}
              </span>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <TeamBadge shortName={match.awayTeam.shortName} color={match.awayTeam.logo} size="sm" />
              <span className="font-heading text-[14px] font-semibold text-white truncate">
                {match.awayTeam.name}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end justify-center gap-1.5 shrink-0 pr-1">
            <span
              className={`font-mono-tabular text-sm font-extrabold min-w-[1.4rem] text-right ${
                match.status === 'live'
                  ? 'text-[#f5b800]'
                  : isFinished
                  ? 'text-zinc-200'
                  : 'text-zinc-600'
              }`}
            >
              {match.status === 'upcoming' ? '–' : match.homeScore}
            </span>
            <span
              className={`font-mono-tabular text-sm font-extrabold min-w-[1.4rem] text-right ${
                match.status === 'live'
                  ? 'text-[#f5b800]'
                  : isFinished
                  ? 'text-zinc-200'
                  : 'text-zinc-600'
              }`}
            >
              {match.status === 'upcoming' ? '–' : match.awayScore}
            </span>
          </div>
        </button>

        {/* Crisp Off-White Odds Buttons -> Solid Gold Active */}
        <div
          className={`grid gap-1.5 shrink-0 ${
            primaryMarkets.length === 3 ? 'grid-cols-3 md:w-[270px]' : 'grid-cols-2 md:w-[205px]'
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
                  toggleSelection({
                    matchId: match.id,
                    marketId: mkt.id,
                    matchLabel: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
                    competitionName: match.competitionName,
                    marketType: mkt.marketType,
                    selectionName: mkt.selectionName,
                    simulatedOdds: mkt.simulatedOdds,
                    status: match.status,
                    startTime: match.startTime,
                  })
                }
                className={`flex items-center justify-between gap-1 rounded-md px-2.5 py-2 text-xs transition-colors min-h-[38px] ${
                  isFinished
                    ? 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                    : active
                    ? 'bg-[#f5b800] text-[#111111] font-bold'
                    : 'bg-[#e8e8ea] hover:bg-white text-[#111111] font-medium'
                }`}
              >
                <span className={`truncate text-[11px] ${active ? 'text-[#111111]/85' : 'text-zinc-500'}`}>
                  {mkt.selectionName}
                </span>
                <span className="font-mono-tabular font-bold shrink-0">
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
