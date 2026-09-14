import {
  ArchitecturalProgram,
  LayoutCandidate,
  LayoutSpace,
  SiteConstraints,
} from "./types";
import { deriveFloorTopology } from "./topology";
import { planTopologyOpenings } from "./openingPlanner";
import { validateHardGeometryConstraints } from "./constraints";
import { scoreCandidate } from "./scoring";

export function prepareCandidate(
  id: string,
  program: ArchitecturalProgram,
  spaces: LayoutSpace[],
  site: SiteConstraints,
  seed?: number
): LayoutCandidate {
  const rawTopology = deriveFloorTopology(spaces);
  const topology = planTopologyOpenings(program, spaces, rawTopology, undefined, site);
  const issues = validateHardGeometryConstraints(program, spaces, topology, site);
  const score = scoreCandidate(program, spaces, topology, site, issues);

  return {
    id,
    spaces,
    topology,
    score,
    seed,
  };
}

/**
 * Valid solutions always rank ahead of invalid ones. Inside each group, the
 * deterministic soft score decides order. This prevents a visually attractive
 * but invalid layout from outranking a compliant candidate.
 */
export function rankCandidates(candidates: LayoutCandidate[]): LayoutCandidate[] {
  return [...candidates].sort((a, b) => {
    const aPass = a.score?.hardConstraintPass ? 1 : 0;
    const bPass = b.score?.hardConstraintPass ? 1 : 0;
    if (aPass !== bPass) return bPass - aPass;

    const aScore = a.score?.total ?? -Infinity;
    const bScore = b.score?.total ?? -Infinity;
    if (aScore !== bScore) return bScore - aScore;

    return a.id.localeCompare(b.id);
  });
}

export function bestValidCandidates(
  candidates: LayoutCandidate[],
  limit = 3
): LayoutCandidate[] {
  return rankCandidates(candidates)
    .filter((candidate) => candidate.score?.hardConstraintPass)
    .slice(0, Math.max(0, limit));
}
