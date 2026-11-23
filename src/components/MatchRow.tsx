import React from 'react';
import { ChevronRight, Layers, Radio } from 'lucide-react';
import { MatchItem } from '../types/sportzone';
import { useSlip } from '../context/SlipContext';
import { CompetitionCountryBadge, TeamBadge } from './BrandLogo';

interface MatchRowProps {
  match: MatchItem;
  onSelectMatch: (matchId: number) => void;
  compactLeagueHeader?: boolean;
}

export function MatchRow({ match, onSelectMatch, compactLeagueHeader = false }: MatchRowProps) {
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

  const statusLabel = React.useMemo(() => {
    if (isLive) {
      const t = (match.matchTimer || '').trim();
      if (/^ht$/i.test(t)) return 'MI-TEMPS';
      return t || 'LIVE';
    }
    if (isFinished) return 'TERMINÉ';
    return `${formattedDate} · ${formattedTime}`;
  }, [isLive, isFinished, match.matchTimer, formattedDate, formattedTime]);

  return (
    <div className="group bg-white hover:bg-[#f4f8ff] border-b border-slate-200/90 last:border-b-0 px-3 sm:px-4 py-3 transition-colors">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        {/* Left: Status / Time + Teams + Crisp 1xBet/MyBet Result Box */}
        <button
          type="button"
          onClick={() => onSelectMatch(match.id)}
          className="flex-1 min-w-0 text-left flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1472e5]"
        >
          {/* Time / Live Badge Column */}
          <div className="w-[78px] sm:w-[88px] shrink-0 flex flex-col items-start gap-1">
            {isLive ? (
              <span className="inline-flex items-center gap-1 rounded bg-[#dc2626] px-2 py-0.5 font-mono-tabular text-[10px] font-black tracking-wide text-white uppercase shadow-2xs">
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                <span>LIVE</span>
              </span>
            ) : isFinished ? (
              <span className="inline-flex items-center rounded bg-slate-800 px-2 py-0.5 font-mono-tabular text-[10px] font-black tracking-wide text-white uppercase">
                FINI
              </span>
            ) : (
              <span className="inline-flex items-center rounded bg-slate-100 border border-slate-300 px-1.5 py-0.5 font-mono-tabular text-[10px] font-extrabold text-slate-800">
                {formattedTime}
              </span>
            )}
            <span
              className={`font-mono-tabular text-[11px] font-extrabold truncate max-w-full ${
                isLive ? 'text-[#dc2626]' : isFinished ? 'text-slate-600' : 'text-slate-500'
              }`}
            >
              {isLive ? statusLabel : isFinished ? `${formattedDate}` : formattedDate}
            </span>
          </div>

          {/* Teams Column */}
          <div className="flex-1 min-w-0 space-y-1.5">
            {!compactLeagueHeader && (
              <div className="flex items-center gap-1.5 mb-1">
                <CompetitionCountryBadge country={match.competitionCountry} />
                <span className="text-[11px] font-extrabold text-slate-600 truncate">
                  {match.competitionName}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2.5 min-w-0">
              <TeamBadge shortName={match.homeTeam.shortName} color={match.homeTeam.logo} size="sm" />
              <span className="font-heading text-[14px] sm:text-[15px] font-extrabold text-slate-950 truncate group-hover:text-[#0b56c2] transition-colors">
                {match.homeTeam.name}
              </span>
            </div>

            <div className="flex items-center gap-2.5 min-w-0">
              <TeamBadge shortName={match.awayTeam.shortName} color={match.awayTeam.logo} size="sm" />
              <span className="font-heading text-[14px] sm:text-[15px] font-extrabold text-slate-950 truncate group-hover:text-[#0b56c2] transition-colors">
                {match.awayTeam.name}
              </span>
            </div>
          </div>

          {/* 1xBet/MyBet Result Capsule */}
          <div className="shrink-0 flex flex-col items-center justify-center gap-1 pl-1">
            {match.status === 'upcoming' ? (
              <div className="w-11 py-2 rounded-lg bg-slate-100 border border-slate-200 text-center">
                <span className="font-mono-tabular text-[11px] font-black text-slate-500">VS</span>
              </div>
            ) : (
              <div
                className={`flex flex-col items-center justify-center w-11 rounded-lg py-1 border shadow-2xs ${
                  isLive
                    ? 'bg-[#091b35] border-[#1472e5] text-white'
                    : 'bg-slate-800 border-slate-700 text-white'
                }`}
              >
                <span
                  className={`font-mono-tabular text-[15px] font-black leading-6 ${
                    isLive ? 'text-[#facc15]' : 'text-white'
                  }`}
                >
                  {match.homeScore}
                </span>
                <span className="w-6 h-px bg-white/15" />
                <span
                  className={`font-mono-tabular text-[15px] font-black leading-6 ${
                    isLive ? 'text-[#facc15]' : 'text-white'
                  }`}
                >
                  {match.awayScore}
                </span>
              </div>
            )}
          </div>
        </button>

        {/* Right: Bold 1 | X | 2 Odds Grid + Markets & Bet Builder */}
        <div className="flex items-center justify-between lg:justify-end gap-2 shrink-0">
          <div
            className={`grid gap-1.5 flex-1 lg:flex-initial ${
              primaryMarkets.length === 3
                ? 'grid-cols-3 lg:w-[276px]'
                : 'grid-cols-2 lg:w-[200px]'
            }`}
          >
            {primaryMarkets.map((mkt) => {
              const active = isSelected(mkt.id);
              const shortLabel =
                mkt.selectionName === match.homeTeam.name
                  ? '1'
                  : mkt.selectionName === match.awayTeam.name
                  ? '2'
                  : mkt.selectionName;
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
                  className={`flex flex-col items-center justify-center rounded-lg px-2 py-2 transition-all min-h-[48px] border ${
                    isFinished
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                      : active
                      ? 'bg-[#1472e5] border-[#0b4ea2] text-white shadow-sm scale-[1.02]'
                      : 'bg-[#edf3fb] hover:bg-[#dbeafe] border-[#c8daf3] hover:border-[#1472e5] text-[#091b35]'
                  }`}
                >
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider leading-none ${
                      active ? 'text-blue-100' : 'text-slate-600'
                    }`}
                  >
                    {shortLabel}
                  </span>
                  <span className="font-mono-tabular text-[14px] font-black mt-1 leading-none">
                    {mkt.simulatedOdds.toFixed(2)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-1 shrink-0 w-[64px]">
            <button
              type="button"
              onClick={() => onSelectMatch(match.id)}
              className={`rounded-lg px-2 py-1.5 text-[11px] font-black inline-flex items-center justify-center gap-0.5 transition-colors border ${
                matchPicks.length > 0
                  ? 'bg-[#16a34a] border-[#15803d] text-white'
                  : 'bg-[#091b35] hover:bg-[#13325f] border-[#091b35] text-white'
              }`}
              title="Ouvrir marchés & Bet Builder"
            >
              {matchPicks.length > 0 ? (
                <>
                  <Layers className="w-3 h-3" />
                  <span>{matchPicks.length}</span>
                </>
              ) : (
                <>
                  <span>+{secondaryCount > 0 ? secondaryCount : 1}</span>
                  <ChevronRight className="w-3 h-3" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
