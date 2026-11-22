import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { SlipMode, SlipSelection } from '../types/sportzone';

interface BetReceipt {
  references: string[];
  mode: SlipMode;
  systemLabel?: string;
  comboCount: number;
  totalStake: number;
  potentialWinnings: number;
}

interface SlipContextValue {
  selections: SlipSelection[];
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
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  setSlipMode: (mode: SlipMode) => void;
  setSystemSize: (k: number) => void;
  toggleSelection: (sel: SlipSelection) => void;
  addMultipleSelections: (sels: SlipSelection[]) => void;
  removeSelection: (marketId: number) => void;
  clearSlip: () => void;
  setStake: (stake: number) => void;
  setLastReceipt: (receipt: BetReceipt | null) => void;
  isSelected: (marketId: number) => boolean;
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
  const [selections, setSelections] = useState<SlipSelection[]>([]);
  const [stake, setStakeState] = useState<number>(1);
  const [slipMode, setSlipMode] = useState<SlipMode>('multiple');
  const [systemSize, setSystemSize] = useState<number>(2);
  const [lastReceipt, setLastReceipt] = useState<BetReceipt | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleSelection = useCallback((sel: SlipSelection) => {
    setLastReceipt(null);
    setSelections((prev) => {
      const exactExists = prev.some((s) => s.marketId === sel.marketId);
      if (exactExists) {
        return prev.filter((s) => s.marketId !== sel.marketId);
      }
      const withoutSameMatch = prev.filter((s) => s.matchId !== sel.matchId);
      return [...withoutSameMatch, sel];
    });
  }, []);

  const addMultipleSelections = useCallback((sels: SlipSelection[]) => {
    setLastReceipt(null);
    setSelections(sels);
  }, []);

  const removeSelection = useCallback((marketId: number) => {
    setSelections((prev) => prev.filter((s) => s.marketId !== marketId));
  }, []);

  const clearSlip = useCallback(() => {
    setSelections([]);
    setLastReceipt(null);
  }, []);

  const setStake = useCallback((value: number) => {
    if (!Number.isFinite(value) || value < 0) {
      setStakeState(0);
    } else {
      setStakeState(Math.min(100000, Math.round(value * 100) / 100));
    }
  }, []);

  const effectiveSystemSize = useMemo(() => {
    if (selections.length < 3) return 2;
    return Math.max(2, Math.min(selections.length - 1, systemSize));
  }, [selections.length, systemSize]);

  const combinedOdds = useMemo(() => {
    if (selections.length === 0) return 0;
    const product = selections.reduce((acc, s) => acc * s.simulatedOdds, 1);
    return round2(product);
  }, [selections]);

  const qualifyingLegs = useMemo(
    () => selections.filter((s) => s.simulatedOdds >= 1.2).length,
    [selections]
  );

  const boostPercent = useMemo(() => {
    if (slipMode !== 'multiple') return 0;
    if (qualifyingLegs >= 4) return 10;
    if (qualifyingLegs >= 3) return 5;
    return 0;
  }, [qualifyingLegs, slipMode]);

  const systemProducts = useMemo(() => {
    if (slipMode !== 'system' || selections.length < 3 || selections.length > 10) return [];
    return getCombinationProducts(
      selections.map((s) => s.simulatedOdds),
      effectiveSystemSize
    );
  }, [slipMode, selections, effectiveSystemSize]);

  const comboCount = useMemo(() => {
    if (selections.length === 0) return 0;
    if (slipMode === 'single') return selections.length;
    if (slipMode === 'system') return systemProducts.length;
    return 1;
  }, [selections.length, slipMode, systemProducts.length]);

  const totalStake = useMemo(() => {
    if (selections.length === 0 || stake <= 0) return 0;
    return round2(stake * comboCount);
  }, [selections.length, stake, comboCount]);

  const baseWinnings = useMemo(() => {
    if (selections.length === 0 || stake <= 0) return 0;
    if (slipMode === 'single') {
      return round2(selections.reduce((sum, s) => sum + round2(stake * s.simulatedOdds), 0));
    }
    if (slipMode === 'system') {
      return round2(systemProducts.reduce((sum, p) => sum + round2(stake * p), 0));
    }
    return round2(stake * combinedOdds);
  }, [selections, stake, slipMode, systemProducts, combinedOdds]);

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

  return (
    <SlipContext.Provider
      value={{
        selections,
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
        mobileOpen,
        setMobileOpen,
        setSlipMode,
        setSystemSize,
        toggleSelection,
        addMultipleSelections,
        removeSelection,
        clearSlip,
        setStake,
        setLastReceipt,
        isSelected,
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
