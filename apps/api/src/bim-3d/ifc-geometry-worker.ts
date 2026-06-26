import { Injectable, Logger } from "@nestjs/common";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

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
  shapeParts?: IfcExtractBoundingBox[];
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
  jobId?: string;
  sourcePath: string;
  outputPath?: string;
  timeoutMs?: number;
  maxProducts?: number;
  selectedClasses?: string[];
  geometryLevel?: "NONE" | "MINIMUM" | "INTERMEDIATE";
  maxShapeParts?: number;
  metadataOutputPath?: string;
  geometryOutputPath?: string;
  onLog?: (entry: IfcGeometryWorkerLogEntry) => void | Promise<void>;
}

export interface IfcGeometryWorkerLogEntry {
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR";
  step: string | null;
  message: string;
  metadata?: Record<string, unknown>;
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

function intFromEnv(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseWorkerLine(line: string): IfcGeometryWorkerLogEntry {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    const level = typeof parsed.level === "string" && ["DEBUG", "INFO", "WARNING", "ERROR"].includes(parsed.level)
      ? parsed.level as IfcGeometryWorkerLogEntry["level"]
      : "INFO";
    return {
      level,
      step: typeof parsed.step === "string" ? parsed.step : null,
      message: typeof parsed.message === "string" ? parsed.message : line,
      metadata: parsed.metadata && typeof parsed.metadata === "object" && !Array.isArray(parsed.metadata)
        ? parsed.metadata as Record<string, unknown>
        : undefined
    };
  } catch {
    return {
      level: "INFO",
      step: null,
      message: line
    };
  }
}

@Injectable()
export class IfcGeometryWorker {
  private readonly logger = new Logger(IfcGeometryWorker.name);
  private readonly activeProcesses = new Map<string, ChildProcessWithoutNullStreams>();
  private readonly cancelledJobs = new Set<string>();

  cancel(jobId: string) {
    this.cancelledJobs.add(jobId);
    const child = this.activeProcesses.get(jobId);
    if (!child) {
      return false;
    }
    child.kill("SIGTERM");
    return true;
  }

  async extract(input: RunExtractionInput): Promise<IfcGeometryExtraction> {
    const outputPath = input.outputPath ?? resolve(dirname(input.sourcePath), "ifcopenshell-extract.v1.json");
    const timeoutMs = input.timeoutMs ?? intFromEnv("IFC_GEOMETRY_TIMEOUT_MS", 60 * 60 * 1000);
    const maxProducts = input.maxProducts ?? intFromEnv("IFC_GEOMETRY_MAX_PRODUCTS_DEFAULT", intFromEnv("IFC_GEOMETRY_MAX_PRODUCTS", 5000));
    const geometryLevel = input.geometryLevel ?? "MINIMUM";
    const maxShapeParts = input.maxShapeParts ?? intFromEnv("IFC_GEOMETRY_MAX_SHAPE_PARTS", 12);
    const args = [
      workerPath(),
      "--input",
      input.sourcePath,
      "--output",
      outputPath,
      "--max-products",
      String(maxProducts),
      "--selected-classes",
      JSON.stringify(input.selectedClasses ?? []),
      "--geometry-level",
      geometryLevel,
      "--max-shape-parts",
      String(maxShapeParts)
    ];
    if (input.metadataOutputPath) {
      args.push("--metadata-output", input.metadataOutputPath);
    }
    if (input.geometryOutputPath) {
      args.push("--geometry-output", input.geometryOutputPath);
    }

    this.logger.log(
      `Starting IFC geometry extraction source=${input.sourcePath} output=${outputPath} python=${pythonExecutable()} worker=${workerPath()} timeoutMs=${timeoutMs} maxProducts=${maxProducts} geometryLevel=${geometryLevel}`
    );

    await new Promise<void>((resolvePromise, rejectPromise) => {
      const child = spawn(pythonExecutable(), args, {
        windowsHide: true
      });
      if (input.jobId) {
        this.activeProcesses.set(input.jobId, child);
      }
      const stderrTail: string[] = [];
      const stdoutTail: string[] = [];
      let stdoutBuffer = "";
      let stderrBuffer = "";
      let timedOut = false;

      const pushTail = (target: string[], value: string) => {
        target.push(value);
        while (target.join("\n").length > 4000) {
          target.shift();
        }
      };

      const emitLine = (line: string, stream: "stdout" | "stderr") => {
        const trimmed = line.trim();
        if (!trimmed) {
          return;
        }
        pushTail(stream === "stdout" ? stdoutTail : stderrTail, trimmed);
        const parsed = parseWorkerLine(trimmed);
        const entry = stream === "stderr" && parsed.level === "INFO"
          ? { ...parsed, level: "ERROR" as const }
          : parsed;
        this.logger.log(`IFC worker ${entry.level} step=${entry.step ?? "-"} message=${entry.message}`);
        void input.onLog?.(entry);
      };

      const flushBuffer = (stream: "stdout" | "stderr", final = false) => {
        const buffer = stream === "stdout" ? stdoutBuffer : stderrBuffer;
        const lines = buffer.split(/\r?\n/);
        const completeLines = final ? lines : lines.slice(0, -1);
        for (const line of completeLines) {
          emitLine(line, stream);
        }
        const remainder = final ? "" : lines.at(-1) ?? "";
        if (stream === "stdout") {
          stdoutBuffer = remainder;
        } else {
          stderrBuffer = remainder;
        }
      };

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        stdoutBuffer += chunk.toString("utf8");
        flushBuffer("stdout");
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderrBuffer += chunk.toString("utf8");
        flushBuffer("stderr");
      });

      child.on("error", (error) => {
        clearTimeout(timer);
        if (input.jobId) {
          this.activeProcesses.delete(input.jobId);
        }
        rejectPromise(error);
      });

      child.on("close", (code, signal) => {
        clearTimeout(timer);
        if (input.jobId) {
          this.activeProcesses.delete(input.jobId);
        }
        flushBuffer("stdout", true);
        flushBuffer("stderr", true);
        if (code === 0) {
          if (input.jobId) {
            this.cancelledJobs.delete(input.jobId);
          }
          resolvePromise();
          return;
        }
        if (input.jobId && this.cancelledJobs.has(input.jobId)) {
          this.cancelledJobs.delete(input.jobId);
          rejectPromise(new Error("IFC geometry extraction cancelled"));
          return;
        }
        const message = timedOut
          ? `IFC geometry extraction timed out after ${timeoutMs} ms`
          : `IFC geometry extraction exited with code ${code ?? "null"} signal ${signal ?? "null"}`;
        this.logger.error(
          `IFC geometry extraction failed source=${input.sourcePath} output=${outputPath} message=${message} stderr=${stderrTail.join("\n").slice(-2000)} stdout=${stdoutTail.join("\n").slice(-1000)}`
        );
        rejectPromise(new Error(`${message}. ${stderrTail.join("\n") || stdoutTail.join("\n")}`));
      });
    });

    const raw = await readFile(outputPath, "utf8");
    const extraction = JSON.parse(raw) as IfcGeometryExtraction;
    this.logger.log(
      `IFC geometry extraction completed source=${input.sourcePath} spatial=${extraction.stats.totalSpatialObjects ?? 0} spatialWithGeometry=${extraction.stats.spatialWithGeometry ?? 0} products=${extraction.stats.totalProducts ?? 0} productsWithGeometry=${extraction.stats.withGeometry ?? 0} errors=${extraction.stats.errors ?? 0}`
    );
    return extraction;
  }
}
