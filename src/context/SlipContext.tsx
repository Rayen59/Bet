import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  applyBetBuilderSelection,
  checkCandidateCompatibility,
  CompatibilityResult,
  groupSelectionsByMatch,
  MarketLike,
  MatchSlipGroup,
  sanitizeMatchSelections,
} from '../lib/betBuilder';
import { SlipMode, SlipSelection } from '../types/sportzone';
import { useToast } from './ToastContext';

interface BetReceipt {
  references: string[];
  mode: SlipMode;
  systemLabel?: string;
  comboCount: number;
  totalStake: number;
  potentialWinnings: number;
}

interface ToggleOptions {
  betBuilder?: boolean;
  homeName?: string;
  awayName?: string;
}

interface SlipContextValue {
  selections: SlipSelection[];
  matchGroups: MatchSlipGroup[];
  stake: number;
  slipMode: SlipMode;
  systemSize: number;
  comboCount: number;
  totalStake: number;
  combinedOdds: number;
  boostPercent: number;
  extraWinnings: number;
  potentialWinnings: number;
  qualifyingLegs: number;
  lastReceipt: BetReceipt | null;
  lastAutoCleaned: string[];
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  setSlipMode: (mode: SlipMode) => void;
  setSystemSize: (k: number) => void;
  toggleSelection: (sel: SlipSelection, options?: ToggleOptions) => void;
  addMultipleSelections: (sels: SlipSelection[]) => void;
  removeSelection: (marketId: number) => void;
  clearMatchSelections: (matchId: number) => void;
  clearSlip: () => void;
  sanitizeSlip: () => number;
  setStake: (stake: number) => void;
  setLastReceipt: (receipt: BetReceipt | null) => void;
  isSelected: (marketId: number) => boolean;
  getMatchSelections: (matchId: number) => SlipSelection[];
  getMarketCompatibility: (
    matchId: number,
    market: MarketLike,
    teamHints?: { homeName?: string; awayName?: string }
  ) => CompatibilityResult;
}

const SlipContext = createContext<SlipContextValue | null>(null);

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getCombinationProducts(odds: number[], k: number): number[] {
  const results: number[] = [];
  function backtrack(start: number, count: number, prod: number) {
    if (count === k) {
      results.push(round2(prod));
      return;
    }
    for (let i = start; i < odds.length; i++) {
      backtrack(i + 1, count + 1, prod * odds[i]);
    }
  }
  backtrack(0, 0, 1);
  return results;
}

export function SlipProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const [selections, setSelections] = useState<SlipSelection[]>([]);
  const selectionsRef = useRef<SlipSelection[]>(selections);
  selectionsRef.current = selections;

  const [stake, setStakeState] = useState<number>(1);
  const [slipMode, setSlipMode] = useState<SlipMode>('multiple');
  const [systemSize, setSystemSize] = useState<number>(2);
  const [lastReceipt, setLastReceipt] = useState<BetReceipt | null>(null);
  const [lastAutoCleaned, setLastAutoCleaned] = useState<string[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleSelection = useCallback(
    (sel: SlipSelection, options?: ToggleOptions) => {
      setLastReceipt(null);
      const prev = selectionsRef.current;
      const exactExists = prev.some((s) => s.marketId === sel.marketId);

      if (exactExists) {
        const next = prev.filter((s) => s.marketId !== sel.marketId);
        selectionsRef.current = next;
        setSelections(next);
        setLastAutoCleaned([]);
        return;
      }

      const sameMatch = prev.filter((s) => s.matchId === sel.matchId);
      const otherMatches = prev.filter((s) => s.matchId !== sel.matchId);

      if (sameMatch.length === 0) {
        const next = [...otherMatches, sel];
        selectionsRef.current = next;
        setSelections(next);
        setLastAutoCleaned([]);
        return;
      }

      const { next: nextSameMatch, removed } = applyBetBuilderSelection(sameMatch, sel, {
        homeName: options?.homeName,
        awayName: options?.awayName,
      });

      const next = [...otherMatches, ...nextSameMatch];
      selectionsRef.current = next;
      setSelections(next);

      if (removed.length > 0) {
        const cleanedNames = removed.map((r) => `${r.item.selectionName} (${r.item.marketType})`);
        setLastAutoCleaned(cleanedNames);
        showToast(
          `Illogical choice removed: ${removed.map((r) => r.item.selectionName).join(', ')}`,
          'info'
        );
      } else {
        setLastAutoCleaned([]);
      }
    },
    [showToast]
  );

  const addMultipleSelections = useCallback(
    (sels: SlipSelection[]) => {
      setLastReceipt(null);
      const byMatch = new Map<number, SlipSelection[]>();
      for (const s of sels) {
        const arr = byMatch.get(s.matchId) || [];
        arr.push(s);
        byMatch.set(s.matchId, arr);
      }

      const cleanedAll: SlipSelection[] = [];
      const removedNames: string[] = [];

      for (const [, group] of byMatch.entries()) {
        const res = sanitizeMatchSelections(group);
        cleanedAll.push(...res.kept);
        for (const r of res.removed) {
          removedNames.push(r.item.selectionName);
        }
      }

      selectionsRef.current = cleanedAll;
      setSelections(cleanedAll);
      setLastAutoCleaned(removedNames);
      if (removedNames.length > 0) {
        showToast(`Filtered out ${removedNames.length} illogical selection(s).`, 'info');
      }
    },
    [showToast]
  );

  const removeSelection = useCallback((marketId: number) => {
    setLastAutoCleaned([]);
    setSelections((prev) => {
      const next = prev.filter((s) => s.marketId !== marketId);
      selectionsRef.current = next;
      return next;
    });
  }, []);

  const clearMatchSelections = useCallback((matchId: number) => {
    setLastAutoCleaned([]);
    setSelections((prev) => {
      const next = prev.filter((s) => s.matchId !== matchId);
      selectionsRef.current = next;
      return next;
    });
  }, []);

  const clearSlip = useCallback(() => {
    selectionsRef.current = [];
    setSelections([]);
    setLastReceipt(null);
    setLastAutoCleaned([]);
  }, []);

  const sanitizeSlip = useCallback(() => {
    const prev = selectionsRef.current;
    const byMatch = new Map<number, SlipSelection[]>();
    for (const s of prev) {
      const arr = byMatch.get(s.matchId) || [];
      arr.push(s);
      byMatch.set(s.matchId, arr);
    }

    const kept: SlipSelection[] = [];
    const removedNames: string[] = [];
    for (const [, group] of byMatch.entries()) {
      const res = sanitizeMatchSelections(group);
      kept.push(...res.kept);
      for (const r of res.removed) removedNames.push(r.item.selectionName);
    }

    if (removedNames.length > 0) {
      selectionsRef.current = kept;
      setSelections(kept);
      setLastAutoCleaned(removedNames);
      showToast(`Removed ${removedNames.length} illogical selection(s): ${removedNames.join(', ')}`, 'info');
    }
    return removedNames.length;
  }, [showToast]);

  const setStake = useCallback((value: number) => {
    if (!Number.isFinite(value) || value < 0) {
      setStakeState(0);
    } else {
      setStakeState(Math.min(100000, Math.round(value * 100) / 100));
    }
  }, []);

  const matchGroups = useMemo(() => groupSelectionsByMatch(selections), [selections]);

  const effectiveSystemSize = useMemo(() => {
    if (matchGroups.length < 3) return 2;
    return Math.max(2, Math.min(matchGroups.length - 1, systemSize));
  }, [matchGroups.length, systemSize]);

  const combinedOdds = useMemo(() => {
    if (matchGroups.length === 0) return 0;
    const product = matchGroups.reduce((acc, g) => acc * g.groupOdds, 1);
    return round2(product);
  }, [matchGroups]);

  const qualifyingLegs = useMemo(
    () => matchGroups.filter((g) => g.groupOdds >= 1.2).length,
    [matchGroups]
  );

  const boostPercent = useMemo(() => {
    if (slipMode !== 'multiple' || matchGroups.length < 3) return 0;
    if (qualifyingLegs >= 4) return 10;
    if (qualifyingLegs >= 3) return 5;
    return 0;
  }, [qualifyingLegs, matchGroups.length, slipMode]);

  const systemProducts = useMemo(() => {
    if (slipMode !== 'system' || matchGroups.length < 3 || matchGroups.length > 10) return [];
    return getCombinationProducts(
      matchGroups.map((g) => g.groupOdds),
      effectiveSystemSize
    );
  }, [slipMode, matchGroups, effectiveSystemSize]);

  const comboCount = useMemo(() => {
    if (matchGroups.length === 0) return 0;
    if (slipMode === 'single') return matchGroups.length;
    if (slipMode === 'system') return systemProducts.length;
    return 1;
  }, [matchGroups.length, slipMode, systemProducts.length]);

  const totalStake = useMemo(() => {
    if (matchGroups.length === 0 || stake <= 0) return 0;
    return round2(stake * comboCount);
  }, [matchGroups.length, stake, comboCount]);

  const baseWinnings = useMemo(() => {
    if (matchGroups.length === 0 || stake <= 0) return 0;
    if (slipMode === 'single') {
      return round2(matchGroups.reduce((sum, g) => sum + round2(stake * g.groupOdds), 0));
    }
    if (slipMode === 'system') {
      return round2(systemProducts.reduce((sum, p) => sum + round2(stake * p), 0));
    }
    return round2(stake * combinedOdds);
  }, [matchGroups, stake, slipMode, systemProducts, combinedOdds]);

  const extraWinnings = useMemo(() => {
    if (boostPercent === 0 || baseWinnings <= 0) return 0;
    return round2(baseWinnings * (boostPercent / 100));
  }, [baseWinnings, boostPercent]);

  const potentialWinnings = useMemo(() => {
    return round2(baseWinnings + extraWinnings);
  }, [baseWinnings, extraWinnings]);

  const isSelected = useCallback(
    (marketId: number) => selections.some((s) => s.marketId === marketId),
    [selections]
  );

  const getMatchSelections = useCallback(
    (matchId: number) => selections.filter((s) => s.matchId === matchId),
    [selections]
  );

  const getMarketCompatibility = useCallback(
    (matchId: number, market: MarketLike, teamHints?: { homeName?: string; awayName?: string }) => {
      const sameMatch = selections.filter((s) => s.matchId === matchId);
      return checkCandidateCompatibility(sameMatch, market, teamHints);
    },
    [selections]
  );

  return (
    <SlipContext.Provider
      value={{
        selections,
        matchGroups,
        stake,
        slipMode,
        systemSize: effectiveSystemSize,
        comboCount,
        totalStake,
        combinedOdds,
        boostPercent,
        extraWinnings,
        potentialWinnings,
        qualifyingLegs,
        lastReceipt,
        lastAutoCleaned,
        mobileOpen,
        setMobileOpen,
        setSlipMode,
        setSystemSize,
        toggleSelection,
        addMultipleSelections,
        removeSelection,
        clearMatchSelections,
        clearSlip,
        sanitizeSlip,
        setStake,
        setLastReceipt,
        isSelected,
        getMatchSelections,
        getMarketCompatibility,
      }}
    >
      {children}
    </SlipContext.Provider>
  );
}

export function useSlip() {
  const ctx = useContext(SlipContext);
  if (!ctx) throw new Error('useSlip must be used inside SlipProvider');
  return ctx;
}
