import { EventEmitter } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IfcGeometryWorker } from "./ifc-geometry-worker";

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn()
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock
}));

function buildChildProcess() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn(() => true);
  return child;
}

function extractionPayload() {
  return {
    version: "ifcopenshell-extract-v1",
    source: { filename: "source.ifc", schema: "IFC4" },
    units: { lengthUnit: "METRE", scaleToMeters: 1 },
    globalBbox: null,
    spatialObjects: [],
    products: [],
    storeys: [],
    stats: {},
    warnings: []
  };
}

describe("IfcGeometryWorker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    spawnMock.mockReset();
  });

  it("uses a one hour default timeout", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ifc-worker-test-"));
    const outputPath = join(directory, "output.json");
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const child = buildChildProcess();
    spawnMock.mockImplementation((_python: string, args: string[]) => {
      const output = args[args.indexOf("--output") + 1];
      void writeFile(output, JSON.stringify(extractionPayload()), "utf8").then(() => {
        child.emit("close", 0, null);
      });
      return child;
    });

    try {
      const worker = new IfcGeometryWorker();
      await worker.extract({ sourcePath: join(directory, "source.ifc"), outputPath });

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60 * 60 * 1000);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("kills an active process by job id", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ifc-worker-test-"));
    const child = buildChildProcess();
    child.kill.mockImplementation(() => {
      child.emit("close", null, "SIGTERM");
      return true;
    });
    spawnMock.mockReturnValue(child);

    try {
      const worker = new IfcGeometryWorker();
      const extraction = worker.extract({
        jobId: "job-1",
        sourcePath: join(directory, "source.ifc"),
        outputPath: join(directory, "output.json")
      });

      expect(worker.cancel("job-1")).toBe(true);
      await expect(extraction).rejects.toThrow("cancelled");
      expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
