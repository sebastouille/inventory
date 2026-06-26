import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { ImportRowPreview } from "@inventory/shared";

function runtimeRoot() {
  return resolve(process.cwd(), "..", "..", ".runtime", "imports");
}

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

async function ensureParentDirectory(path: string) {
  await mkdir(dirname(path), { recursive: true });
}

export async function persistImportSourceFile(
  organizationId: string,
  jobId: string,
  originalFilename: string,
  buffer: Buffer
) {
  const extension = extname(originalFilename) || ".bin";
  const filename = `${sanitizeSegment(jobId)}-${randomUUID()}${extension}`;
  const relativePath = join(sanitizeSegment(organizationId), sanitizeSegment(jobId), filename);
  const absolutePath = join(runtimeRoot(), relativePath);
  await ensureParentDirectory(absolutePath);
  await writeFile(absolutePath, buffer);
  return {
    absolutePath,
    relativePath
  };
}

export async function persistImportSourcePath(
  organizationId: string,
  jobId: string,
  originalFilename: string,
  sourcePath: string
) {
  const extension = extname(originalFilename) || ".bin";
  const filename = `${sanitizeSegment(jobId)}-${randomUUID()}${extension}`;
  const relativePath = join(sanitizeSegment(organizationId), sanitizeSegment(jobId), filename);
  const absolutePath = join(runtimeRoot(), relativePath);
  await ensureParentDirectory(absolutePath);
  await copyFile(sourcePath, absolutePath);
  return {
    absolutePath,
    relativePath
  };
}

export async function persistRawRows(
  organizationId: string,
  jobId: string,
  rows: ImportRowPreview[]
) {
  const filename = `${sanitizeSegment(jobId)}-rows.json`;
  const relativePath = join(sanitizeSegment(organizationId), sanitizeSegment(jobId), filename);
  const absolutePath = join(runtimeRoot(), relativePath);
  await ensureParentDirectory(absolutePath);
  await writeFile(absolutePath, JSON.stringify(rows, null, 2), "utf8");
  return {
    absolutePath,
    relativePath
  };
}

export async function readRawRows(rawRowsRef: string) {
  const absolutePath = join(runtimeRoot(), rawRowsRef);
  const content = await readFile(absolutePath, "utf8");
  return JSON.parse(content) as ImportRowPreview[];
}

export async function persistImportArtifact<T>(organizationId: string, jobId: string, filename: string, payload: T) {
  const relativePath = join(sanitizeSegment(organizationId), sanitizeSegment(jobId), sanitizeSegment(filename));
  const absolutePath = join(runtimeRoot(), relativePath);
  await ensureParentDirectory(absolutePath);
  await writeFile(absolutePath, JSON.stringify(payload, null, 2), "utf8");
  return {
    absolutePath,
    relativePath
  };
}

export async function readImportArtifact<T>(relativePath: string) {
  const absolutePath = join(runtimeRoot(), relativePath);
  const content = await readFile(absolutePath, "utf8");
  return JSON.parse(content) as T;
}

export function resolveImportArtifact(relativePath: string) {
  return join(runtimeRoot(), relativePath);
}

export async function removeImportJobArtifacts(organizationId: string, jobId: string) {
  const absolutePath = join(runtimeRoot(), sanitizeSegment(organizationId), sanitizeSegment(jobId));
  await rm(absolutePath, { recursive: true, force: true });
}
