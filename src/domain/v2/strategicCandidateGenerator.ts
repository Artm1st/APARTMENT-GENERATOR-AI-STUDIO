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
}

export interface StrategicGenerationResult {
  alternatives: StrategicAlternative[];
  generatedCount: number;
  validCount: number;
}

/**
 * Generates independent candidate families for distinct design strategies.
 * This prevents A/B/C from being merely small seed variations of the same idea.
 */
export function generateStrategicAlternatives(
  baseProgram: ArchitecturalProgram,
  site: SiteConstraints,
  protocols: DesignProtocolSet,
  baseSeed: number,
  totalCandidateBudget = 30,
  strategyLimit = 3
): StrategicGenerationResult {
  const strategies = selectTypologyStrategies(protocols, site, strategyLimit);
  const perStrategy = Math.max(3, Math.floor(totalCandidateBudget / strategies.length));
  const alternatives: StrategicAlternative[] = [];
  let generatedCount = 0;
  let validCount = 0;

  strategies.forEach((strategy, index) => {
    const program = applyTypologyStrategy(baseProgram, strategy, protocols);
    const strategySeed = (baseSeed + (index + 1) * 104729) >>> 0;
    const ranked = generateRankedCandidates(program, site, strategySeed, {
      candidateCount: perStrategy,
      gridSize: 0.1,
      scanStep: strategy.id === "evolutionary_spine" ? 0.4 : 0.5,
      dimensionJitter: strategy.dimensionJitter,
    });

    const valid = ranked.filter((candidate) => candidate.score?.hardConstraintPass === true);
    const selected = valid[0] ?? ranked[0];
    generatedCount += ranked.length;
    validCount += valid.length;

    if (!selected) return;
    alternatives.push({
      strategy,
      program,
      candidate: selected,
      generatedCount: ranked.length,
      validCount: valid.length,
    });
  });

  return {
    alternatives,
    generatedCount,
    validCount,
  };
}
