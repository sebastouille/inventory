import { Injectable, Logger } from "@nestjs/common";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface IfcExtractBoundingBox {
  min: [number, number, number];
  max: [number, number, number];
}

export interface IfcExtractObject {
  globalId: string | null;
  ifcEntityId: number | null;
  ifcClass: string;
  name: string | null;
  description: string | null;
  parentGlobalId: string | null;
  storeyGlobalId: string | null;
  bbox: IfcExtractBoundingBox | null;
  center: [number, number, number] | null;
  size: [number, number, number] | null;
  hasGeometry: boolean;
  geometryError: string | null;
  childrenCount?: number;
  elevation?: number | null;
}

export interface IfcGeometryExtraction {
  version: "ifcopenshell-extract-v1";
  source: {
    filename: string;
    schema: string;
  };
  units: {
    lengthUnit: string;
    scaleToMeters: number;
  };
  globalBbox: IfcExtractBoundingBox | null;
  spatialObjects: IfcExtractObject[];
  products: IfcExtractObject[];
  storeys: IfcExtractObject[];
  stats: Record<string, number>;
  warnings: string[];
}

interface RunExtractionInput {
  sourcePath: string;
  outputPath?: string;
  timeoutMs?: number;
  maxProducts?: number;
}

function workerPath() {
  const candidates = [
    resolve(process.cwd(), "workers", "ifc_geometry", "extract_scene.py"),
    resolve(process.cwd(), "apps", "api", "workers", "ifc_geometry", "extract_scene.py")
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function pythonExecutable() {
  return process.env.IFC_GEOMETRY_PYTHON?.trim() || process.env.PYTHON?.trim() || "python";
}

@Injectable()
export class IfcGeometryWorker {
  private readonly logger = new Logger(IfcGeometryWorker.name);

  async extract(input: RunExtractionInput): Promise<IfcGeometryExtraction> {
    const outputPath = input.outputPath ?? resolve(dirname(input.sourcePath), "ifcopenshell-extract.v1.json");
    const args = [
      workerPath(),
      "--input",
      input.sourcePath,
      "--output",
      outputPath,
      "--max-products",
      String(input.maxProducts ?? 20000)
    ];

    try {
      this.logger.log(
        `Starting IFC geometry extraction source=${input.sourcePath} output=${outputPath} python=${pythonExecutable()} worker=${workerPath()}`
      );
      await execFileAsync(pythonExecutable(), args, {
        timeout: input.timeoutMs ?? 120000,
        maxBuffer: 1024 * 1024 * 4,
        windowsHide: true
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "IfcOpenShell extraction failed";
      const stderr = typeof error === "object" && error && "stderr" in error ? String(error.stderr) : "";
      const stdout = typeof error === "object" && error && "stdout" in error ? String(error.stdout) : "";
      this.logger.error(
        `IFC geometry extraction failed source=${input.sourcePath} output=${outputPath} message=${message} stderr=${stderr.slice(0, 2000)} stdout=${stdout.slice(0, 1000)}`
      );
      throw new Error(`IfcOpenShell extraction failed: ${message}`);
    }

    const raw = await readFile(outputPath, "utf8");
    const extraction = JSON.parse(raw) as IfcGeometryExtraction;
    this.logger.log(
      `IFC geometry extraction completed source=${input.sourcePath} spatial=${extraction.stats.totalSpatialObjects ?? 0} spatialWithGeometry=${extraction.stats.spatialWithGeometry ?? 0} products=${extraction.stats.totalProducts ?? 0} productsWithGeometry=${extraction.stats.withGeometry ?? 0} errors=${extraction.stats.errors ?? 0}`
    );
    return extraction;
  }
}
