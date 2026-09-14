import {
  ArchitecturalProgram,
  FloorTopology,
  GeometryIssue,
  LayoutSpace,
  SiteConstraints,
  WallSide,
} from "./types";
import { boundaryBetween, getSpaceBounds, spacesOverlap } from "./topology";
import { resolvedEntrySide } from "./architecturalGrammarV3";
import { furnitureFitIssues } from "./habitability";

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

function entryWallSide(site: SiteConstraints): WallSide {
  switch (resolvedEntrySide(site)) {
    case "back": return "top";
    case "left": return "left";
    case "right": return "right";
    case "front":
    default: return "bottom";
  }
}

function validateMainEntry(
  spaces: LayoutSpace[],
  topology: FloorTopology,
  site: SiteConstraints
): GeometryIssue[] {
  const entry = topology.openings.find(
    (opening) => opening.type === "door" && opening.role === "main_entry" && !opening.spaceBId
  );
  if (!entry) {
    return [{
      code: "MISSING_MAIN_ENTRY",
      severity: "error",
      message: `No existe una puerta principal exterior válida orientada hacia el lado de ingreso seleccionado (${resolvedEntrySide(site)}).`,
      spaceIds: [],
    }];
  }

  const receiver = spaces.find((space) => space.id === entry.spaceAId);
  const host = topology.exteriorBoundaries.find((boundary) => boundary.id === entry.hostBoundaryId);
  const validReceiver = receiver && receiver.floor === 0 && !["bathroom", "bedroom", "kitchen", "laundry", "garage"].includes(receiver.type);
  const validHost = host && host.spaceId === receiver?.id && host.side === entryWallSide(site);

  if (!validReceiver || !validHost) {
    return [{
      code: "MISSING_MAIN_ENTRY",
      severity: "error",
      message: "La puerta principal no conecta correctamente el exterior con un espacio público/distribuidor de planta baja en la fachada de ingreso.",
      spaceIds: receiver ? [receiver.id] : [],
    }];
  }
  return [];
}

function validateCirculationConnectivity(
  spaces: LayoutSpace[],
  topology: FloorTopology
): GeometryIssue[] {
  const issues: GeometryIssue[] = [];
  const floors = [...new Set(spaces.map((space) => space.floor))];
  const mainEntry = topology.openings.find(
    (opening) => opening.type === "door" && opening.role === "main_entry"
  );

  for (const floor of floors) {
    const interior = spaces.filter(
      (space) =>
        space.floor === floor &&
        space.type !== "patio" &&
        space.type !== "terrace"
    );
    if (interior.length <= 1) continue;

    const eligibleIds = new Set(interior.map((space) => space.id));
    const graph = new Map<string, Set<string>>(
      interior.map((space) => [space.id, new Set<string>()])
    );

    for (const opening of topology.openings) {
      if (opening.type !== "door" || !opening.spaceBId) continue;
      if (!eligibleIds.has(opening.spaceAId) || !eligibleIds.has(opening.spaceBId)) continue;
      graph.get(opening.spaceAId)?.add(opening.spaceBId);
      graph.get(opening.spaceBId)?.add(opening.spaceAId);
    }

    const root =
      (floor === 0 && mainEntry && eligibleIds.has(mainEntry.spaceAId)
        ? interior.find((space) => space.id === mainEntry.spaceAId)
        : undefined) ??
      interior.find((space) => space.type === "stair") ??
      interior.find((space) => space.type === "corridor") ??
      interior.find((space) => space.type === "living") ??
      interior.find((space) => space.type === "dining") ??
      interior[0];

    const visited = new Set<string>([root.id]);
    const queue = [root.id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const neighbor of graph.get(current) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }

    const unreachable = interior.filter((space) => !visited.has(space.id));
    if (unreachable.length > 0) {
      issues.push({
        code: "DISCONNECTED_CIRCULATION",
        severity: "error",
        message: `La circulación interior de la planta ${floor + 1} está desconectada. Ambientes sin ruta de puertas desde ${floor === 0 ? "el ingreso principal" : "el núcleo vertical/distribuidor"}: ${unreachable.map((space) => space.label).join(", ")}.`,
        spaceIds: unreachable.map((space) => space.id),
      });
    }
  }

  return issues;
}

function validateVerticalConnections(spaces: LayoutSpace[]): GeometryIssue[] {
  const floors = [...new Set(spaces.map((space) => space.floor))].sort((a, b) => a - b);
  if (floors.length <= 1) return [];

  const issues: GeometryIssue[] = [];
  const stackGroups = new Map<string, LayoutSpace[]>();
  for (const space of spaces) {
    if (!space.verticalStackKey) continue;
    const group = stackGroups.get(space.verticalStackKey) ?? [];
    group.push(space);
    stackGroups.set(space.verticalStackKey, group);
  }

  const occupiedFloors = new Set(floors);
  const validStack = [...stackGroups.values()].find((group) => {
    const groupFloors = new Set(group.map((space) => space.floor));
    if ([...occupiedFloors].some((floor) => !groupFloors.has(floor))) return false;
    const anchor = group[0];
    return group.every(
      (space) => Math.abs(space.x - anchor.x) <= 0.12 && Math.abs(space.y - anchor.y) <= 0.12
    );
  });

  if (!validStack) {
    issues.push({
      code: "MISSING_VERTICAL_CONNECTION",
      severity: "error",
      message: "La propuesta tiene varios niveles, pero no existe una escalera o conexión vertical continua y alineada entre las plantas ocupadas.",
      spaceIds: spaces.filter((space) => space.type === "stair").map((space) => space.id),
    });
  }

  return issues;
}

function validatePairRules(
  program: ArchitecturalProgram,
  spaces: LayoutSpace[],
  topology: FloorTopology
): GeometryIssue[] {
  const issues: GeometryIssue[] = [];
  const byProgramId = layoutMapByProgramId(spaces);

  for (const rule of program.pairRules ?? []) {
    const a = byProgramId.get(rule.a);
    const b = byProgramId.get(rule.b);
    if (!a || !b || a.floor !== b.floor) continue;

    if (rule.kind === "no_direct_access" && hasDoorBetween(topology, a.id, b.id)) {
      issues.push({
        code: "FORBIDDEN_DIRECT_ACCESS",
        severity: rule.severity,
        message: `${a.label} y ${b.label} no deben tener acceso directo entre sí. ${rule.rationale}`,
        spaceIds: [a.id, b.id],
      });
    }

    if (rule.kind === "avoid_adjacency") {
      const shared = boundaryBetween(topology, a.id, b.id);
      if (shared) {
        issues.push({
          code: "FORBIDDEN_TOUCH",
          severity: rule.severity,
          message: `${a.label} y ${b.label} comparten ${shared.length.toFixed(2)} m de muro; se recomienda introducir un filtro o reconsiderar la adyacencia. ${rule.rationale}`,
          spaceIds: [a.id, b.id],
        });
      }
    }
  }

  return issues;
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
    if (!a || !b || a.floor !== b.floor) continue;

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

  issues.push(...validateMainEntry(spaces, topology, site));
  issues.push(...validatePairRules(program, spaces, topology));
  issues.push(...furnitureFitIssues(spaces));
  issues.push(...validateCirculationConnectivity(spaces, topology));
  issues.push(...validateVerticalConnections(spaces));
  return issues;
}

export function hardConstraintsPass(issues: GeometryIssue[]): boolean {
  return !issues.some((issue) => issue.severity === "error");
}
