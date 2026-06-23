import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { Bim3dScene } from "@inventory/shared";

function runtimeRoot() {
  return resolve(process.cwd(), "..", "..", ".runtime", "bim-3d");
}

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

async function ensureParentDirectory(path: string) {
  await mkdir(dirname(path), { recursive: true });
}

export function resolveBim3dRuntimePath(relativePath: string) {
  return join(runtimeRoot(), relativePath);
}

export async function persistBim3dScene(organizationId: string, mapId: string, scene: Bim3dScene) {
  const relativePath = join(sanitizeSegment(organizationId), sanitizeSegment(mapId), "scene.v1.json");
  const absolutePath = join(runtimeRoot(), relativePath);
  await ensureParentDirectory(absolutePath);
  await writeFile(absolutePath, JSON.stringify(scene, null, 2), "utf8");
  return {
    absolutePath,
    relativePath
  };
}

export async function persistBim3dSourceFile(
  organizationId: string,
  mapId: string,
  filename: string,
  content: Buffer
) {
  const extension = filename.toLowerCase().endsWith(".ifc") ? ".ifc" : "";
  const relativePath = join(sanitizeSegment(organizationId), sanitizeSegment(mapId), `source${extension}`);
  const absolutePath = join(runtimeRoot(), relativePath);
  await ensureParentDirectory(absolutePath);
  await writeFile(absolutePath, content);
  return {
    absolutePath,
    relativePath
  };
}

export async function persistBim3dExtraction(
  organizationId: string,
  mapId: string,
  content: unknown
) {
  const relativePath = join(sanitizeSegment(organizationId), sanitizeSegment(mapId), "ifcopenshell-extract.v1.json");
  const absolutePath = join(runtimeRoot(), relativePath);
  await ensureParentDirectory(absolutePath);
  await writeFile(absolutePath, JSON.stringify(content, null, 2), "utf8");
  return {
    absolutePath,
    relativePath
  };
}

export async function readBim3dScene(sceneFileRef: string) {
  const absolutePath = join(runtimeRoot(), sceneFileRef);
  const content = await readFile(absolutePath, "utf8");
  return JSON.parse(content) as Bim3dScene;
}
