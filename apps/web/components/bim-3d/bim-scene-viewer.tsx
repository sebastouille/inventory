"use client";

import type { Bim3dAgeBucket, Bim3dScene, Bim3dSceneEquipment, Bim3dSceneNode } from "@inventory/shared";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type Bim3dSelection =
  | { kind: "node"; item: Bim3dSceneNode }
  | { kind: "equipment"; item: Bim3dSceneEquipment }
  | null;

interface BimSceneViewerProps {
  scene: Bim3dScene;
  heatmapEnabled: boolean;
  visibleNodeIds: Set<string>;
  visibleEquipmentIds: Set<string>;
  selected: Bim3dSelection;
  onSelect: (selection: Bim3dSelection) => void;
  showFloorGuides?: boolean;
}

function boxCenter(box: Bim3dSceneNode["bbox"]) {
  return new THREE.Vector3(
    (box.min.x + box.max.x) / 2,
    (box.min.y + box.max.y) / 2,
    (box.min.z + box.max.z) / 2
  );
}

function boxSize(box: Bim3dSceneNode["bbox"]) {
  return new THREE.Vector3(
    Math.max(0.2, box.max.x - box.min.x),
    Math.max(0.2, box.max.y - box.min.y),
    Math.max(0.2, box.max.z - box.min.z)
  );
}

function colorForEquipment(scene: Bim3dScene, equipment: Bim3dSceneEquipment, heatmapEnabled: boolean) {
  return heatmapEnabled ? scene.materials.heatmap[equipment.ageBucket] : scene.materials.equipment;
}

function labelForBucket(bucket: Bim3dAgeBucket) {
  return {
    FRESH: "0 a 1 mois",
    RECENT: "1 a 3 mois",
    WARNING: "3 a 6 mois",
    STALE: "6 a 12 mois",
    CRITICAL: "Plus de 12 mois",
    UNKNOWN: "Non inventorie"
  } satisfies Record<Bim3dAgeBucket, string>;
}

export function BimSceneViewer({
  scene,
  heatmapEnabled,
  visibleNodeIds,
  visibleEquipmentIds,
  selected,
  onSelect,
  showFloorGuides = true
}: BimSceneViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return undefined;
    }
    const mountElement: HTMLDivElement = element;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mountElement.innerHTML = "";
    mountElement.appendChild(renderer.domElement);

    const threeScene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 2000);
    camera.position.set(78, 58, 88);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.target.set(0, 3, 0);

    threeScene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.25));
    const grid = new THREE.GridHelper(220, 44, 0x94a3b8, 0xdbeafe);
    grid.position.y = -0.02;
    threeScene.add(grid);

    const floorGuideMeshes: THREE.Mesh[] = [];
    if (showFloorGuides) {
      for (const guide of scene.floorGuides ?? []) {
        const size = boxSize(guide.bbox);
        const geometry = new THREE.BoxGeometry(size.x, Math.max(0.04, Math.min(0.12, size.y || 0.08)), size.z);
        const material = new THREE.MeshBasicMaterial({
          color: 0x0ea5e9,
          transparent: true,
          opacity: 0.08,
          wireframe: false,
          depthWrite: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        const center = boxCenter(guide.bbox);
        mesh.position.set(center.x, guide.elevation + 0.03, center.z);
        threeScene.add(mesh);
        floorGuideMeshes.push(mesh);

        const outline = new THREE.Mesh(
          geometry.clone(),
          new THREE.MeshBasicMaterial({
            color: 0x0284c7,
            transparent: true,
            opacity: 0.45,
            wireframe: true
          })
        );
        outline.position.copy(mesh.position);
        threeScene.add(outline);
        floorGuideMeshes.push(outline);
      }
    }

    const nodeMeshes: Array<{ mesh: THREE.Mesh; node: Bim3dSceneNode }> = [];
    for (const node of scene.nodes) {
      if (!visibleNodeIds.has(node.id)) continue;
      const size = boxSize(node.bbox);
      const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
      const material = new THREE.MeshBasicMaterial({
        color: scene.materials.node[node.type],
        transparent: true,
        opacity: 0.12,
        wireframe: true
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(boxCenter(node.bbox));
      mesh.userData.kind = "node";
      mesh.userData.id = node.id;
      threeScene.add(mesh);
      nodeMeshes.push({ mesh, node });
    }

    const equipments = scene.equipments.filter((equipment) => visibleEquipmentIds.has(equipment.id));
    const equipmentGeometry = new THREE.BoxGeometry(1, 1, 1);
    const equipmentMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.72,
      metalness: 0.08,
      vertexColors: true
    });
    const equipmentMesh = new THREE.InstancedMesh(equipmentGeometry, equipmentMaterial, equipments.length);
    equipmentMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    equipments.forEach((equipment, index) => {
      const scale = new THREE.Vector3(equipment.size.x, equipment.size.y, equipment.size.z);
      const position = new THREE.Vector3(equipment.position.x, equipment.position.y, equipment.position.z);
      matrix.compose(position, new THREE.Quaternion(), scale);
      equipmentMesh.setMatrixAt(index, matrix);
      equipmentMesh.setColorAt(index, color.set(colorForEquipment(scene, equipment, heatmapEnabled)));
    });
    if (equipmentMesh.instanceColor) {
      equipmentMesh.instanceColor.needsUpdate = true;
    }
    equipmentMesh.userData.kind = "equipment";
    threeScene.add(equipmentMesh);

    const selectedMeshMaterial = new THREE.MeshBasicMaterial({
      color: scene.materials.selected,
      wireframe: true
    });
    const selectedMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), selectedMeshMaterial);
    selectedMesh.visible = false;
    threeScene.add(selectedMesh);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function updateSize() {
      const rect = mountElement.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / Math.max(1, rect.height);
      camera.updateProjectionMatrix();
    }

    function updateSelectionMesh() {
      if (!selected) {
        selectedMesh.visible = false;
        return;
      }
      if (selected.kind === "node") {
        const size = boxSize(selected.item.bbox);
        selectedMesh.scale.set(size.x + 1, size.y + 1, size.z + 1);
        selectedMesh.position.copy(boxCenter(selected.item.bbox));
        selectedMesh.visible = visibleNodeIds.has(selected.item.id);
        controls.target.copy(selectedMesh.position);
        return;
      }
      selectedMesh.scale.set(selected.item.size.x * 1.8, selected.item.size.y * 1.8, selected.item.size.z * 1.8);
      selectedMesh.position.set(selected.item.position.x, selected.item.position.y, selected.item.position.z);
      selectedMesh.visible = visibleEquipmentIds.has(selected.item.id);
      controls.target.copy(selectedMesh.position);
    }

    function handlePointerDown(event: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const equipmentHits = raycaster.intersectObject(equipmentMesh, false);
      const equipmentHit = equipmentHits[0];
      if (equipmentHit && typeof equipmentHit.instanceId === "number") {
        onSelectRef.current({ kind: "equipment", item: equipments[equipmentHit.instanceId] });
        return;
      }

      const nodeHits = raycaster.intersectObjects(nodeMeshes.map((entry) => entry.mesh), false);
      const nodeHit = nodeHits[0];
      if (nodeHit) {
        const entry = nodeMeshes.find((candidate) => candidate.mesh === nodeHit.object);
        if (entry) {
          onSelectRef.current({ kind: "node", item: entry.node });
          return;
        }
      }

      onSelectRef.current(null);
    }

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(mountElement);
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    updateSize();
    updateSelectionMesh();

    let frame = 0;
    function render() {
      controls.update();
      renderer.render(threeScene, camera);
      frame = requestAnimationFrame(render);
    }
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      controls.dispose();
      equipmentGeometry.dispose();
      equipmentMaterial.dispose();
      selectedMesh.geometry.dispose();
      selectedMeshMaterial.dispose();
      for (const entry of nodeMeshes) {
        entry.mesh.geometry.dispose();
        const material = entry.mesh.material;
        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose());
        } else {
          material.dispose();
        }
      }
      for (const mesh of floorGuideMeshes) {
        mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose());
        } else {
          material.dispose();
        }
      }
      renderer.dispose();
      mountElement.innerHTML = "";
    };
  }, [heatmapEnabled, scene, selected, showFloorGuides, visibleEquipmentIds, visibleNodeIds]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-sky-50 via-white to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950">
      <div ref={containerRef} className="h-[62vh] min-h-[420px] w-full touch-none md:h-[72vh]" />
      <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-border/70 bg-background/92 px-4 py-3 text-xs shadow-xl backdrop-blur">
        <p className="font-heading text-sm font-semibold text-foreground">Controle 3D</p>
        <p className="text-muted-foreground">Rotation, deplacement lateral et zoom actifs.</p>
        <p className="text-muted-foreground">Mode: {scene.metadata.geometrySource ?? scene.limits.mode}</p>
      </div>
      <div className="absolute bottom-4 left-4 flex max-w-[min(680px,calc(100%-2rem))] flex-wrap gap-2 rounded-2xl border border-border/70 bg-background/92 p-2 text-xs shadow-xl backdrop-blur">
        {Object.entries(scene.materials.heatmap).map(([bucket, value]) => (
          <span key={bucket} className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-2 py-1">
            <span className="size-2 rounded-full" style={{ backgroundColor: value }} />
            {labelForBucket(bucket as Bim3dAgeBucket)[bucket as Bim3dAgeBucket]}
          </span>
        ))}
      </div>
    </div>
  );
}
