/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Room, Terrain } from "../types";
import { Maximize2, Minimize2, RefreshCw } from "lucide-react";

interface ThreeDViewProps {
  rooms: Room[];
  terrain: Terrain;
}

export default function ThreeDView({ rooms, terrain }: ThreeDViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<"textured" | "wireframe">("textured");

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. SCENE & CAMERA
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#F3F4F6"); // Slate bg

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(terrain.width, 15, terrain.length * 1.2);

    // 2. RENDERER
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 3. CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // don't go below ground
    controls.minDistance = 3;
    controls.maxDistance = 60;
    // Set target to center of terrain
    controls.target.set(terrain.width / 2, 0, terrain.length / 2);
    controls.update();

    // 4. LIGHTS
    const ambientLight = new THREE.AmbientLight("#FFFFFF", 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight("#FFFFFF", 0.8);
    dirLight.position.set(15, 30, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    const d = 15;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    const floorLight = new THREE.DirectionalLight("#93C5FD", 0.2); // sky reflection blue
    floorLight.position.set(-15, -10, -15);
    scene.add(floorLight);

    // 5. GROUND (TERRAIN PLANE)
    const groundGeo = new THREE.PlaneGeometry(terrain.width, terrain.length);
    const groundMat = new THREE.MeshStandardMaterial({
      color: "#E5E7EB", // light grey ground
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    // Position ground so top left is at (0,0) on terrain coords
    ground.position.set(terrain.width / 2, -0.01, terrain.length / 2);
    ground.receiveShadow = true;
    scene.add(ground);

    // Draw Terrain Boundary line
    const borderGeo = new THREE.BoxGeometry(terrain.width, 0.05, terrain.length);
    const borderMat = new THREE.MeshBasicMaterial({
      color: "#9CA3AF",
      wireframe: true,
    });
    const border = new THREE.Mesh(borderGeo, borderMat);
    border.position.set(terrain.width / 2, 0.025, terrain.length / 2);
    scene.add(border);

    // Grid Helper
    const gridHelper = new THREE.GridHelper(
      Math.max(terrain.width, terrain.length) * 1.5,
      Math.max(terrain.width, terrain.length) * 1.5,
      "#9CA3AF",
      "#D1D5DB"
    );
    gridHelper.position.set(terrain.width / 2, 0, terrain.length / 2);
    scene.add(gridHelper);

    // 5.5 BUILD 3D PERIMETER WALL (MURO PERIMÉTRICO)
    if (terrain.hasPerimeterWall) {
      const pWallHeight = 2.0;
      const pWallThickness = 0.15;
      const pWallMat = new THREE.MeshStandardMaterial({
        color: "#cbd5e1", // slate-300
        roughness: 0.8,
        metalness: 0.1,
      });
      const columnMat = new THREE.MeshStandardMaterial({
        color: "#94a3b8", // slate-400 for structural accents
        roughness: 0.7,
      });

      // Left perimeter wall
      const pLeftGeo = new THREE.BoxGeometry(pWallThickness, pWallHeight, terrain.length);
      const pLeftMesh = new THREE.Mesh(pLeftGeo, pWallMat);
      pLeftMesh.position.set(0, pWallHeight / 2, terrain.length / 2);
      pLeftMesh.castShadow = true;
      pLeftMesh.receiveShadow = true;
      scene.add(pLeftMesh);

      // Right perimeter wall
      const pRightGeo = new THREE.BoxGeometry(pWallThickness, pWallHeight, terrain.length);
      const pRightMesh = new THREE.Mesh(pRightGeo, pWallMat);
      pRightMesh.position.set(terrain.width, pWallHeight / 2, terrain.length / 2);
      pRightMesh.castShadow = true;
      pRightMesh.receiveShadow = true;
      scene.add(pRightMesh);

      // Back perimeter wall
      const pBackGeo = new THREE.BoxGeometry(terrain.width, pWallHeight, pWallThickness);
      const pBackMesh = new THREE.Mesh(pBackGeo, pWallMat);
      pBackMesh.position.set(terrain.width / 2, pWallHeight / 2, terrain.length);
      pBackMesh.castShadow = true;
      pBackMesh.receiveShadow = true;
      scene.add(pBackMesh);

      // Front perimeter walls with central gate gap
      const gateWidth = 4.0;
      const wallPartWidth = (terrain.width - gateWidth) / 2;
      const rightPartStart = wallPartWidth + gateWidth;

      // Front Left segment
      const pFrontLeftGeo = new THREE.BoxGeometry(wallPartWidth, pWallHeight, pWallThickness);
      const pFrontLeftMesh = new THREE.Mesh(pFrontLeftGeo, pWallMat);
      pFrontLeftMesh.position.set(wallPartWidth / 2, pWallHeight / 2, 0);
      pFrontLeftMesh.castShadow = true;
      pFrontLeftMesh.receiveShadow = true;
      scene.add(pFrontLeftMesh);

      // Front Right segment
      const pFrontRightGeo = new THREE.BoxGeometry(wallPartWidth, pWallHeight, pWallThickness);
      const pFrontRightMesh = new THREE.Mesh(pFrontRightGeo, pWallMat);
      pFrontRightMesh.position.set(rightPartStart + wallPartWidth / 2, pWallHeight / 2, 0);
      pFrontRightMesh.castShadow = true;
      pFrontRightMesh.receiveShadow = true;
      scene.add(pFrontRightMesh);

      // Gate Columns (Pedestals)
      const columnGeo = new THREE.BoxGeometry(0.3, pWallHeight + 0.2, 0.3);
      
      const leftCol = new THREE.Mesh(columnGeo, columnMat);
      leftCol.position.set(wallPartWidth, (pWallHeight + 0.2) / 2, 0);
      leftCol.castShadow = true;
      scene.add(leftCol);

      const rightCol = new THREE.Mesh(columnGeo, columnMat);
      rightCol.position.set(rightPartStart, (pWallHeight + 0.2) / 2, 0);
      rightCol.castShadow = true;
      scene.add(rightCol);

      // Simple open metal gate frames for visual aesthetics (at 45 degree angle)
      const gateLeafGeo = new THREE.BoxGeometry(gateWidth / 2, pWallHeight * 0.8, 0.03);
      const gateMat = new THREE.MeshStandardMaterial({
        color: "#4F46E5", // Indigo-600 gate color
        roughness: 0.5,
        metalness: 0.8,
      });

      // Left gate swing group
      const leftGateGroup = new THREE.Group();
      leftGateGroup.position.set(wallPartWidth, 0.05, 0);
      const leftGateMesh = new THREE.Mesh(gateLeafGeo, gateMat);
      leftGateMesh.position.set((gateWidth / 4), (pWallHeight * 0.8) / 2, 0);
      leftGateMesh.castShadow = true;
      leftGateGroup.add(leftGateMesh);
      leftGateGroup.rotation.y = Math.PI / 4; // Swing outwards
      scene.add(leftGateGroup);

      // Right gate swing group
      const rightGateGroup = new THREE.Group();
      rightGateGroup.position.set(rightPartStart, 0.05, 0);
      const rightGateMesh = new THREE.Mesh(gateLeafGeo, gateMat);
      rightGateMesh.position.set(-(gateWidth / 4), (pWallHeight * 0.8) / 2, 0);
      rightGateMesh.castShadow = true;
      rightGateGroup.add(rightGateMesh);
      rightGateGroup.rotation.y = -Math.PI / 4; // Swing outwards
      scene.add(rightGateGroup);
    }

    // 6. BUILD PLAN ELEMENTS
    const wallHeight = 2.8;
    const wallThickness = 0.15;

    // Materials
    const wallMat = new THREE.MeshStandardMaterial({
      color: "#FDFDFD",
      roughness: 0.5,
      metalness: 0.05,
    });
    const floorMats = {
      living: new THREE.MeshStandardMaterial({ color: "#FDE68A", roughness: 0.7 }), // wood/tile orange
      bedroom: new THREE.MeshStandardMaterial({ color: "#93C5FD", roughness: 0.8 }), // blue carpet
      bathroom: new THREE.MeshStandardMaterial({ color: "#A5F3FC", roughness: 0.3, metalness: 0.2 }), // tile cyan
      kitchen: new THREE.MeshStandardMaterial({ color: "#FCA5A5", roughness: 0.4 }), // grey tile
      dining: new THREE.MeshStandardMaterial({ color: "#FDE68A", roughness: 0.7 }),
      corridor: new THREE.MeshStandardMaterial({ color: "#E5E7EB", roughness: 0.5 }),
      garage: new THREE.MeshStandardMaterial({ color: "#D1D5DB", roughness: 0.5 }),
      laundry: new THREE.MeshStandardMaterial({ color: "#E0E7FF", roughness: 0.5 }),
      other: new THREE.MeshStandardMaterial({ color: "#F3F4F6", roughness: 0.7 }),
    };

    const windowGlassMat = new THREE.MeshStandardMaterial({
      color: "#38BDF8",
      transparent: true,
      opacity: 0.5,
      roughness: 0.1,
      metalness: 0.9,
    });
    const windowFrameMat = new THREE.MeshStandardMaterial({
      color: "#1F2937",
      roughness: 0.4,
    });
    const doorWoodMat = new THREE.MeshStandardMaterial({
      color: "#78350F", // warm wood brown
      roughness: 0.6,
    });

    rooms.forEach((room) => {
      // Room slab floor
      const roomFloorGeo = new THREE.BoxGeometry(room.w, 0.08, room.h);
      const mat = floorMats[room.type as keyof typeof floorMats] || floorMats.other;
      const roomFloor = new THREE.Mesh(roomFloorGeo, viewMode === "wireframe" ? new THREE.MeshBasicMaterial({ wireframe: true, color: 0x333333 }) : mat);
      roomFloor.position.set(room.x, 0.04, room.y);
      roomFloor.receiveShadow = true;
      roomFloor.castShadow = true;
      scene.add(roomFloor);

      // Construct room walls with window/door cutouts
      const halfW = room.w / 2;
      const halfH = room.h / 2;

      // Define the four walls around the room
      // Left, Right, Bottom, Top
      const walls = [
        { name: "left", x: room.x - halfW, z: room.y, rotY: Math.PI / 2, length: room.h },
        { name: "right", x: room.x + halfW, z: room.y, rotY: Math.PI / 2, length: room.h },
        { name: "bottom", x: room.x, z: room.y - halfH, rotY: 0, length: room.w },
        { name: "top", x: room.x, z: room.y + halfH, rotY: 0, length: room.w },
      ];

      walls.forEach((wallDef) => {
        // Find openings on this wall side
        const sideOpenings = room.openings.filter((o) => o.side === wallDef.name);

        if (sideOpenings.length === 0 || viewMode === "wireframe") {
          // Solid Wall
          const wGeo = new THREE.BoxGeometry(wallDef.length, wallHeight, wallThickness);
          const wallMesh = new THREE.Mesh(wGeo, viewMode === "wireframe" ? new THREE.MeshBasicMaterial({ wireframe: true, color: 0x999999 }) : wallMat);
          wallMesh.position.set(wallDef.x, wallHeight / 2, wallDef.z);
          wallMesh.rotation.y = wallDef.rotY;
          wallMesh.castShadow = true;
          wallMesh.receiveShadow = true;
          scene.add(wallMesh);
        } else {
          // Build wall with openings by subdividing horizontally
          // We sort the openings by offset from 0 to 1
          const sortedOpenings = [...sideOpenings].sort((a, b) => a.offset - b.offset);

          let currentPos = -wallDef.length / 2;

          sortedOpenings.forEach((op, idx) => {
            const opCenter = -wallDef.length / 2 + wallDef.length * op.offset;
            const opHalf = op.width / 2;
            const opStart = opCenter - opHalf;
            const opEnd = opCenter + opHalf;

            // 1. Left solid part of wall (before opening)
            if (opStart > currentPos) {
              const partLen = opStart - currentPos;
              const partX = currentPos + partLen / 2;

              const wGeo = new THREE.BoxGeometry(partLen, wallHeight, wallThickness);
              const wallMesh = new THREE.Mesh(wGeo, wallMat);

              // Calculate offset relative to wall center
              const tempOffset = new THREE.Vector3(partX, wallHeight / 2, 0);
              tempOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), wallDef.rotY);

              wallMesh.position.set(wallDef.x + tempOffset.x, wallHeight / 2, wallDef.z + tempOffset.z);
              wallMesh.rotation.y = wallDef.rotY;
              wallMesh.castShadow = true;
              wallMesh.receiveShadow = true;
              scene.add(wallMesh);
            }

            // 2. Opening parts (sill, lintel, doors, windows)
            if (op.type === "door") {
              // Lintel above door (from 2.1m to 2.8m)
              const lintelH = wallHeight - 2.1;
              const lintelGeo = new THREE.BoxGeometry(op.width, lintelH, wallThickness);
              const lintelMesh = new THREE.Mesh(lintelGeo, wallMat);

              const tempOffset = new THREE.Vector3(opCenter, 2.1 + lintelH / 2, 0);
              tempOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), wallDef.rotY);

              lintelMesh.position.set(wallDef.x + tempOffset.x, tempOffset.y, wallDef.z + tempOffset.z);
              lintelMesh.rotation.y = wallDef.rotY;
              lintelMesh.castShadow = true;
              lintelMesh.receiveShadow = true;
              scene.add(lintelMesh);

              // Render visual Door leaf swung open slightly (45 degrees)
              const doorGeo = new THREE.BoxGeometry(op.width, 2.1, 0.04);
              const doorMesh = new THREE.Mesh(doorGeo, doorWoodMat);
              // Pivot door at opStart
              const doorPivot = new THREE.Group();
              doorPivot.position.set(opStart, 0, 0);
              doorMesh.position.set(op.width / 2, 2.1 / 2, 0);
              doorPivot.add(doorMesh);
              doorPivot.rotation.y = -Math.PI / 4; // Swing out slightly

              const finalOffset = new THREE.Vector3();
              doorPivot.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), wallDef.rotY);
              doorPivot.position.add(new THREE.Vector3(wallDef.x, 0, wallDef.z));
              doorPivot.rotation.y += wallDef.rotY;
              scene.add(doorPivot);

            } else if (op.type === "window") {
              // Bottom Sill (from 0 to 0.9m)
              const sillGeo = new THREE.BoxGeometry(op.width, 0.9, wallThickness);
              const sillMesh = new THREE.Mesh(sillGeo, wallMat);
              const tempOffsetSill = new THREE.Vector3(opCenter, 0.9 / 2, 0);
              tempOffsetSill.applyAxisAngle(new THREE.Vector3(0, 1, 0), wallDef.rotY);
              sillMesh.position.set(wallDef.x + tempOffsetSill.x, tempOffsetSill.y, wallDef.z + tempOffsetSill.z);
              sillMesh.rotation.y = wallDef.rotY;
              sillMesh.castShadow = true;
              sillMesh.receiveShadow = true;
              scene.add(sillMesh);

              // Top Lintel (from 2.1m to 2.8m)
              const lintelH = wallHeight - 2.1;
              const lintelGeo = new THREE.BoxGeometry(op.width, lintelH, wallThickness);
              const lintelMesh = new THREE.Mesh(lintelGeo, wallMat);
              const tempOffsetLintel = new THREE.Vector3(opCenter, 2.1 + lintelH / 2, 0);
              tempOffsetLintel.applyAxisAngle(new THREE.Vector3(0, 1, 0), wallDef.rotY);
              lintelMesh.position.set(wallDef.x + tempOffsetLintel.x, tempOffsetLintel.y, wallDef.z + tempOffsetLintel.z);
              lintelMesh.rotation.y = wallDef.rotY;
              lintelMesh.castShadow = true;
              lintelMesh.receiveShadow = true;
              scene.add(lintelMesh);

              // Window Glass Panel (from 0.9m to 2.1m)
              const glassGeo = new THREE.BoxGeometry(op.width, 1.2, 0.02);
              const glassMesh = new THREE.Mesh(glassGeo, windowGlassMat);
              const tempOffsetGlass = new THREE.Vector3(opCenter, 0.9 + 1.2 / 2, 0);
              tempOffsetGlass.applyAxisAngle(new THREE.Vector3(0, 1, 0), wallDef.rotY);
              glassMesh.position.set(wallDef.x + tempOffsetGlass.x, tempOffsetGlass.y, wallDef.z + tempOffsetGlass.z);
              glassMesh.rotation.y = wallDef.rotY;
              scene.add(glassMesh);

              // Window Frame
              const frameGeo = new THREE.BoxGeometry(op.width, 1.2, wallThickness - 0.02);
              const frameMesh = new THREE.Mesh(frameGeo, windowFrameMat);
              frameMesh.position.copy(glassMesh.position);
              frameMesh.rotation.copy(glassMesh.rotation);
              frameMesh.scale.set(1.02, 1.02, 0.3); // slight inset frame border
              scene.add(frameMesh);
            }

            currentPos = opEnd;
          });

          // 3. Right solid part of wall (after the last opening)
          if (currentPos < wallDef.length / 2) {
            const partLen = wallDef.length / 2 - currentPos;
            const partX = currentPos + partLen / 2;

            const wGeo = new THREE.BoxGeometry(partLen, wallHeight, wallThickness);
            const wallMesh = new THREE.Mesh(wGeo, wallMat);

            const tempOffset = new THREE.Vector3(partX, wallHeight / 2, 0);
            tempOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), wallDef.rotY);

            wallMesh.position.set(wallDef.x + tempOffset.x, wallHeight / 2, wallDef.z + tempOffset.z);
            wallMesh.rotation.y = wallDef.rotY;
            wallMesh.castShadow = true;
            wallMesh.receiveShadow = true;
            scene.add(wallMesh);
          }
        }
      });

      // 7. FURNITURE PROCEDURAL ASSEMBLIES
      room.furniture.forEach((fItem) => {
        const absX = room.x + fItem.x;
        const absY = room.y + fItem.y;
        const fRotY = (fItem.rotation * Math.PI) / 180;

        const fGroup = new THREE.Group();
        fGroup.position.set(absX, 0, absY);
        fGroup.rotation.y = -fRotY; // standard CAD coordinate rotation

        if (viewMode === "wireframe") {
          // Simple box helper in wireframe
          const boxHelper = new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(fItem.w, 0.5, fItem.h)), 0x10b981);
          fGroup.add(boxHelper);
          scene.add(fGroup);
          return;
        }

        // Procedural assemblies based on type
        switch (fItem.type) {
          case "bed": {
            // Bed frame
            const frameGeo = new THREE.BoxGeometry(fItem.w, 0.25, fItem.h);
            const frameMat = new THREE.MeshStandardMaterial({ color: "#57534E", roughness: 0.8 }); // wood dark
            const frame = new THREE.Mesh(frameGeo, frameMat);
            frame.position.y = 0.125;
            frame.castShadow = true;
            frame.receiveShadow = true;
            fGroup.add(frame);

            // Headboard
            const headGeo = new THREE.BoxGeometry(fItem.w, 0.7, 0.08);
            const head = new THREE.Mesh(headGeo, frameMat);
            head.position.set(0, 0.35, -fItem.h / 2 + 0.04);
            head.castShadow = true;
            fGroup.add(head);

            // Mattress
            const mattGeo = new THREE.BoxGeometry(fItem.w - 0.08, 0.2, fItem.h - 0.12);
            const mattMat = new THREE.MeshStandardMaterial({ color: "#F9FAFB", roughness: 0.9 });
            const mattress = new THREE.Mesh(mattGeo, mattMat);
            mattress.position.set(0, 0.25 + 0.1, 0.04);
            mattress.castShadow = true;
            mattress.receiveShadow = true;
            fGroup.add(mattress);

            // Pillows (2)
            const pilGeo = new THREE.BoxGeometry((fItem.w - 0.2) / 2, 0.05, 0.3);
            const pilMat = new THREE.MeshStandardMaterial({ color: "#E5E7EB", roughness: 0.9 });
            
            const pillow1 = new THREE.Mesh(pilGeo, pilMat);
            pillow1.position.set(-fItem.w / 4, 0.37, -fItem.h / 2 + 0.25);
            fGroup.add(pillow1);

            const pillow2 = new THREE.Mesh(pilGeo, pilMat);
            pillow2.position.set(fItem.w / 4, 0.37, -fItem.h / 2 + 0.25);
            fGroup.add(pillow2);
            break;
          }

          case "sofa": {
            const sofaMat = new THREE.MeshStandardMaterial({ color: "#4B5563", roughness: 0.8 }); // slate sofa
            // Seat Cushion Base
            const baseGeo = new THREE.BoxGeometry(fItem.w, 0.25, fItem.h);
            const base = new THREE.Mesh(baseGeo, sofaMat);
            base.position.y = 0.25;
            base.castShadow = true;
            fGroup.add(base);

            // Backrest (runs along the back width)
            const backGeo = new THREE.BoxGeometry(fItem.w, 0.5, 0.15);
            const back = new THREE.Mesh(backGeo, sofaMat);
            back.position.set(0, 0.5, -fItem.h / 2 + 0.075);
            back.castShadow = true;
            fGroup.add(back);

            // Armrests (2)
            const armGeo = new THREE.BoxGeometry(0.12, 0.4, fItem.h);
            const armLeft = new THREE.Mesh(armGeo, sofaMat);
            armLeft.position.set(-fItem.w / 2 + 0.06, 0.4, 0);
            armLeft.castShadow = true;
            fGroup.add(armLeft);

            const armRight = new THREE.Mesh(armGeo, sofaMat);
            armRight.position.set(fItem.w / 2 - 0.06, 0.4, 0);
            armRight.castShadow = true;
            fGroup.add(armRight);
            break;
          }

          case "dining_table": {
            const woodMat = new THREE.MeshStandardMaterial({ color: "#B45309", roughness: 0.6 });
            // Table top
            const topGeo = new THREE.BoxGeometry(fItem.w, 0.04, fItem.h);
            const top = new THREE.Mesh(topGeo, woodMat);
            top.position.y = 0.74;
            top.castShadow = true;
            top.receiveShadow = true;
            fGroup.add(top);

            // 4 legs
            const legGeo = new THREE.CylinderGeometry(0.04, 0.03, 0.72);
            const legOffsetW = fItem.w / 2 - 0.08;
            const legOffsetH = fItem.h / 2 - 0.08;

            const pos = [
              [-legOffsetW, -legOffsetH],
              [legOffsetW, -legOffsetH],
              [-legOffsetW, legOffsetH],
              [legOffsetW, legOffsetH],
            ];

            pos.forEach(([lx, lh]) => {
              const leg = new THREE.Mesh(legGeo, woodMat);
              leg.position.set(lx, 0.36, lh);
              leg.castShadow = true;
              fGroup.add(leg);
            });
            break;
          }

          case "tv": {
            // TV stand console
            const consoleGeo = new THREE.BoxGeometry(fItem.w, 0.4, fItem.h);
            const consoleMat = new THREE.MeshStandardMaterial({ color: "#27272A", roughness: 0.5 });
            const tvConsole = new THREE.Mesh(consoleGeo, consoleMat);
            tvConsole.position.y = 0.2;
            tvConsole.castShadow = true;
            tvConsole.receiveShadow = true;
            fGroup.add(tvConsole);

            // TV screen
            const tvGeo = new THREE.BoxGeometry(fItem.w * 0.8, fItem.w * 0.45, 0.05);
            const tvScreenMat = new THREE.MeshStandardMaterial({ color: "#111", roughness: 0.2, metalness: 0.8 });
            const tvMesh = new THREE.Mesh(tvGeo, tvScreenMat);
            tvMesh.position.set(0, 0.4 + (fItem.w * 0.45) / 2, 0);
            tvMesh.castShadow = true;
            fGroup.add(tvMesh);
            break;
          }

          case "toilet": {
            const ceramicMat = new THREE.MeshStandardMaterial({ color: "#F3F4F6", roughness: 0.2 });
            // Toilet bowl
            const bowlGeo = new THREE.CylinderGeometry(0.2, 0.16, 0.4, 16);
            const bowl = new THREE.Mesh(bowlGeo, ceramicMat);
            bowl.position.set(0, 0.2, 0.1);
            bowl.castShadow = true;
            fGroup.add(bowl);

            // Tank
            const tankGeo = new THREE.BoxGeometry(0.4, 0.45, 0.18);
            const tank = new THREE.Mesh(tankGeo, ceramicMat);
            tank.position.set(0, 0.4, -0.15);
            tank.castShadow = true;
            fGroup.add(tank);
            break;
          }

          case "sink": {
            const cabMat = new THREE.MeshStandardMaterial({ color: "#F3F4F6", roughness: 0.4 });
            const sinkCabinet = new THREE.Mesh(new THREE.BoxGeometry(fItem.w, 0.8, fItem.h), cabMat);
            sinkCabinet.position.y = 0.4;
            sinkCabinet.castShadow = true;
            sinkCabinet.receiveShadow = true;
            fGroup.add(sinkCabinet);

            // Tap
            const tapGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.15);
            const tapMat = new THREE.MeshStandardMaterial({ color: "#D1D5DB", metalness: 0.9, roughness: 0.1 });
            const tap = new THREE.Mesh(tapGeo, tapMat);
            tap.position.set(0, 0.85, -fItem.h / 3);
            fGroup.add(tap);
            break;
          }

          case "shower": {
            const glassWallMat = new THREE.MeshStandardMaterial({
              color: "#38BDF8",
              transparent: true,
              opacity: 0.3,
              roughness: 0.1,
            });
            const baseGeo = new THREE.BoxGeometry(fItem.w, 0.08, fItem.h);
            const base = new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({ color: "#E5E7EB", roughness: 0.4 }));
            base.position.y = 0.04;
            base.receiveShadow = true;
            fGroup.add(base);

            // Enclosure glass panels (2 sides)
            const glassGeo = new THREE.BoxGeometry(0.02, 1.9, fItem.h);
            const glass = new THREE.Mesh(glassGeo, glassWallMat);
            glass.position.set(-fItem.w / 2 + 0.01, 1.0, 0);
            fGroup.add(glass);

            const glassFront = new THREE.Mesh(new THREE.BoxGeometry(fItem.w, 1.9, 0.02), glassWallMat);
            glassFront.position.set(0, 1.0, fItem.h / 2 - 0.01);
            fGroup.add(glassFront);
            break;
          }

          case "fridge": {
            const steelMat = new THREE.MeshStandardMaterial({ color: "#9CA3AF", metalness: 0.8, roughness: 0.2 });
            const fridgeBox = new THREE.Mesh(new THREE.BoxGeometry(fItem.w, 1.8, fItem.h), steelMat);
            fridgeBox.position.y = 0.9;
            fridgeBox.castShadow = true;
            fGroup.add(fridgeBox);

            // Door handle lines
            const handleGeo = new THREE.BoxGeometry(0.02, 0.5, 0.03);
            const handle = new THREE.Mesh(handleGeo, new THREE.MeshStandardMaterial({ color: "#374151" }));
            handle.position.set(fItem.w / 2 - 0.05, 1.1, fItem.h / 2 + 0.01);
            fGroup.add(handle);
            break;
          }

          case "stove": {
            const stoveMat = new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.4 });
            const stoveBox = new THREE.Mesh(new THREE.BoxGeometry(fItem.w, 0.85, fItem.h), stoveMat);
            stoveBox.position.y = 0.425;
            stoveBox.castShadow = true;
            fGroup.add(stoveBox);

            // Burners
            const burnerMat = new THREE.MeshStandardMaterial({ color: "#374151", roughness: 0.7 });
            const burnerGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.01, 16);
            
            const offsets = [
              [-fItem.w / 4, -fItem.h / 4],
              [fItem.w / 4, -fItem.h / 4],
              [-fItem.w / 4, fItem.h / 4],
              [fItem.w / 4, fItem.h / 4],
            ];

            offsets.forEach(([bx, bz]) => {
              const burner = new THREE.Mesh(burnerGeo, burnerMat);
              burner.position.set(bx, 0.855, bz);
              fGroup.add(burner);
            });
            break;
          }

          case "plant": {
            // Pot
            const potGeo = new THREE.CylinderGeometry(0.18, 0.12, 0.3, 12);
            const potMat = new THREE.MeshStandardMaterial({ color: "#D97706", roughness: 0.8 }); // terracotta
            const pot = new THREE.Mesh(potGeo, potMat);
            pot.position.y = 0.15;
            pot.castShadow = true;
            fGroup.add(pot);

            // Leaves
            const leafGeo = new THREE.SphereGeometry(0.25, 8, 8);
            const leafMat = new THREE.MeshStandardMaterial({ color: "#047857", roughness: 0.9 });
            const leafGroup = new THREE.Group();
            
            const leaf1 = new THREE.Mesh(leafGeo, leafMat);
            leaf1.position.set(0, 0.38, 0);
            leaf1.scale.set(0.9, 1.2, 0.9);
            leafGroup.add(leaf1);

            const leaf2 = new THREE.Mesh(leafGeo, leafMat);
            leaf2.position.set(0.12, 0.45, -0.06);
            leaf2.scale.set(0.8, 1.1, 0.8);
            leafGroup.add(leaf2);

            const leaf3 = new THREE.Mesh(leafGeo, leafMat);
            leaf3.position.set(-0.1, 0.42, 0.1);
            leaf3.scale.set(0.85, 1.0, 0.85);
            leafGroup.add(leaf3);

            fGroup.add(leafGroup);
            break;
          }

          default: {
            // Basic Box placeholder for others (desk, chair, wardrobe)
            const boxGeo = new THREE.BoxGeometry(fItem.w, 0.75, fItem.h);
            const placeholderMat = new THREE.MeshStandardMaterial({ color: "#D1D5DB", roughness: 0.6 });
            const placeholder = new THREE.Mesh(boxGeo, placeholderMat);
            placeholder.position.y = 0.375;
            placeholder.castShadow = true;
            fGroup.add(placeholder);
          }
        }

        scene.add(fGroup);
      });
    });

    // 8. ANIMATION LOOP
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 9. RESIZE OBSERVER
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(containerRef.current);

    // CLEANUP
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, [rooms, terrain, viewMode]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  return (
    <div
      ref={containerRef}
      id="3d-viewer-container"
      className={`relative w-full h-full bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col ${
        isFullscreen ? "p-0 rounded-none border-none h-screen" : "min-h-[450px]"
      }`}
    >
      {/* 3D Toolbar Controls */}
      <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center pointer-events-none">
        <div className="flex gap-2 pointer-events-auto bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200/50 shadow-sm">
          <button
            id="3d-view-textured"
            onClick={() => setViewMode("textured")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              viewMode === "textured"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Fotorrealista
          </button>
          <button
            id="3d-view-wireframe"
            onClick={() => setViewMode("wireframe")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              viewMode === "wireframe"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Estructura (Alambre)
          </button>
        </div>

        <div className="flex gap-2 pointer-events-auto">
          <button
            id="3d-view-fullscreen"
            onClick={toggleFullscreen}
            title="Pantalla Completa"
            className="p-2 bg-white/95 backdrop-blur-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200/50 shadow-sm transition-all"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <canvas ref={canvasRef} className="w-full h-full block touch-none" id="3d-plan-canvas" />

      {/* 3D Legend Hint */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200/50 shadow-sm text-[10px] text-slate-500 pointer-events-none flex flex-col gap-1">
        <span className="font-semibold text-slate-700 flex items-center gap-1">
          <RefreshCw className="w-3 h-3 animate-spin-slow text-indigo-500" /> Control de Cámara 3D
        </span>
        <span>• Arrastre click izquierdo para Rotar</span>
        <span>• Arrastre click derecho para Desplazar</span>
        <span>• Scroll / Pellizco para Hacer Zoom</span>
      </div>
    </div>
  );
}
