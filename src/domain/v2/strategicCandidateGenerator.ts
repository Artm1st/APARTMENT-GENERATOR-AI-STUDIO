import type { DesignProtocolSet } from "./designProtocols";
import { generateRankedCandidates } from "./candidateGenerator";
import {
  applyTypologyStrategy,
  selectTypologyStrategies,
  TypologyStrategySelection,
} from "./typologyStrategies";
import type { ArchitecturalProgram, LayoutCandidate, SiteConstraints } from "./types";

export interface StrategicAlternative {
  strategy: TypologyStrategySelection;
  program: ArchitecturalProgram;
  candidate: LayoutCandidate;
  generatedCount: number;
  validCount: number;
  repairPassUsed: boolean;
}

export interface StrategicGenerationResult {
  alternatives: StrategicAlternative[];
  generatedCount: number;
  validCount: number;
  repairedStrategies: number;
}

function validCandidates(candidates: LayoutCandidate[]): LayoutCandidate[] {
  return candidates.filter((candidate) => candidate.score?.hardConstraintPass === true);
}

/**
 * Generates independent candidate families for distinct design strategies.
 * Each family now uses a strategy-specific geometric grammar. If the initial
 * family has no valid candidate, a denser deterministic repair pass explores
 * finer placement positions before returning an invalid fallback.
 */
export function generateStrategicAlternatives(
  baseProgram: ArchitecturalProgram,
  site: SiteConstraints,
  protocols: DesignProtocolSet,
  baseSeed: number,
  totalCandidateBudget = 36,
  strategyLimit = 3
): StrategicGenerationResult {
  const strategies = selectTypologyStrategies(protocols, site, strategyLimit);
  const perStrategy = Math.max(4, Math.floor(totalCandidateBudget / strategies.length));
  const alternatives: StrategicAlternative[] = [];
  let generatedCount = 0;
  let validCount = 0;
  let repairedStrategies = 0;

  strategies.forEach((strategy, index) => {
    const program = applyTypologyStrategy(baseProgram, strategy, protocols);
    const strategySeed = (baseSeed + (index + 1) * 104729) >>> 0;
    const grammar = {
      id: strategy.id,
      variant: strategySeed % 2,
    } as const;

    let ranked = generateRankedCandidates(program, site, strategySeed, {
      candidateCount: perStrategy,
      gridSize: 0.1,
      scanStep: strategy.id === "evolutionary_spine" ? 0.4 : 0.5,
      dimensionJitter: strategy.dimensionJitter,
      grammar,
    });

    let valid = validCandidates(ranked);
    let repairPassUsed = false;
    generatedCount += ranked.length;
    validCount += valid.length;

    if (valid.length === 0) {
      repairPassUsed = true;
      repairedStrategies++;
      const repairSeed = (strategySeed + 7919) >>> 0;
      const repaired = generateRankedCandidates(program, site, repairSeed, {
        candidateCount: Math.max(6, Math.ceil(perStrategy * 0.75)),
        gridSize: 0.1,
        scanStep: 0.25,
        dimensionJitter: Math.max(0.06, strategy.dimensionJitter * 0.65),
        grammar,
      });
      const repairedValid = validCandidates(repaired);
      generatedCount += repaired.length;
      validCount += repairedValid.length;
      ranked = [...ranked, ...repaired].sort((a, b) => {
        const hardA = a.score?.hardConstraintPass ? 1 : 0;
        const hardB = b.score?.hardConstraintPass ? 1 : 0;
        if (hardA !== hardB) return hardB - hardA;
        return (b.score?.total ?? -Infinity) - (a.score?.total ?? -Infinity);
      });
      valid = validCandidates(ranked);
    }

    const selected = valid[0] ?? ranked[0];
    if (!selected) return;

    alternatives.push({
      strategy,
      program,
      candidate: selected,
      generatedCount: ranked.length,
      validCount: valid.length,
      repairPassUsed,
    });
  });

  return {
    alternatives,
    generatedCount,
    validCount,
    repairedStrategies,
  };
}
