import {
  ArchitecturalProgram,
  FloorTopology,
  GeometryIssue,
  LayoutSpace,
  SiteConstraints,
} from "./types";
import { boundaryBetween, getSpaceBounds, spacesOverlap } from "./topology";

function layoutMapByProgramId(spaces: LayoutSpace[]): Map<string, LayoutSpace> {
  return new Map(spaces.map((space) => [space.programSpaceId, space]));
}

function hasDoorBetween(
  topology: FloorTopology,
  aId: string,
  bId: string
): boolean {
  return topology.openings.some(
    (opening) =>
      opening.type === "door" &&
      ((opening.spaceAId === aId && opening.spaceBId === bId) ||
        (opening.spaceAId === bId && opening.spaceBId === aId))
  );
}

function hasValidExteriorWindow(topology: FloorTopology, spaceId: string): boolean {
  const exteriorIds = new Set(
    topology.exteriorBoundaries
      .filter((boundary) => boundary.spaceId === spaceId)
      .map((boundary) => boundary.id)
  );

  return topology.openings.some(
    (opening) =>
      opening.type === "window" &&
      opening.spaceAId === spaceId &&
      exteriorIds.has(opening.hostBoundaryId)
  );
}

export function validateHardGeometryConstraints(
  program: ArchitecturalProgram,
  spaces: LayoutSpace[],
  topology: FloorTopology,
  site: SiteConstraints,
  tolerance = 0.02
): GeometryIssue[] {
  const issues: GeometryIssue[] = [];

  for (let i = 0; i < spaces.length; i++) {
    for (let j = i + 1; j < spaces.length; j++) {
      const a = spaces[i];
      const b = spaces[j];
      if (!spacesOverlap(a, b, tolerance)) continue;

      issues.push({
        code: "SPACE_OVERLAP",
        severity: "error",
        message: `${a.label} y ${b.label} se solapan físicamente.`,
        spaceIds: [a.id, b.id],
      });
    }
  }

  const buildable = {
    minX: site.setbackLeft,
    maxX: site.width - site.setbackRight,
    minY: site.setbackFront,
    maxY: site.length - site.setbackBack,
  };

  for (const space of spaces) {
    const bounds = getSpaceBounds(space);
    const outside =
      bounds.minX < buildable.minX - tolerance ||
      bounds.maxX > buildable.maxX + tolerance ||
      bounds.minY < buildable.minY - tolerance ||
      bounds.maxY > buildable.maxY + tolerance;

    if (outside) {
      issues.push({
        code: "OUTSIDE_BUILDABLE_AREA",
        severity: "error",
        message: `${space.label} excede el polígono edificable definido por los parámetros del sitio.`,
        spaceIds: [space.id],
      });
    }
  }

  const byProgramId = layoutMapByProgramId(spaces);

  for (const programSpace of program.spaces) {
    if (!programSpace.requiresExteriorOpening) continue;
    const layoutSpace = byProgramId.get(programSpace.id);
    if (!layoutSpace) continue;

    if (!hasValidExteriorWindow(topology, layoutSpace.id)) {
      issues.push({
        code: "MISSING_EXTERIOR_OPENING",
        severity: "error",
        message: `${layoutSpace.label} requiere una abertura exterior, pero no tiene una ventana hospedada en un borde exterior real.`,
        spaceIds: [layoutSpace.id],
      });
    }
  }

  for (const relation of program.relations) {
    const a = byProgramId.get(relation.a);
    const b = byProgramId.get(relation.b);
    if (!a || !b) continue;

    const shared = boundaryBetween(topology, a.id, b.id);

    if ((relation.kind === "must_touch" || relation.kind === "direct_access") && !shared) {
      issues.push({
        code: "MISSING_REQUIRED_TOUCH",
        severity: "error",
        message: `${a.label} y ${b.label} deben compartir un límite físico, pero no lo hacen.`,
        spaceIds: [a.id, b.id],
      });
      continue;
    }

    if (relation.kind === "must_not_touch" && shared) {
      issues.push({
        code: "FORBIDDEN_TOUCH",
        severity: "error",
        message: `${a.label} y ${b.label} no deben ser adyacentes, pero comparten ${shared.length.toFixed(2)} m de muro.`,
        spaceIds: [a.id, b.id],
      });
    }

    if (relation.kind === "direct_access" && shared && !hasDoorBetween(topology, a.id, b.id)) {
      issues.push({
        code: "BROKEN_DIRECT_ACCESS",
        severity: "error",
        message: `${a.label} y ${b.label} requieren acceso directo, pero no existe una puerta válida sobre su muro compartido.`,
        spaceIds: [a.id, b.id],
      });
    }
  }

  return issues;
}

export function hardConstraintsPass(issues: GeometryIssue[]): boolean {
  return !issues.some((issue) => issue.severity === "error");
}
