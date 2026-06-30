"use client";

import type {
  CompleteInventoryNodeResult,
  InventoryCampaignDetail,
  InventoryCampaignSyncInput,
  InventoryCampaignSyncResponse,
  ScanSource
} from "@inventory/shared";
import { parseScanPayload } from "@inventory/shared";
import { Button, Field, Input, PageSection, StatusBadge } from "@inventory/ui";
import {
  ArrowLeftIcon,
  BluetoothIcon,
  CameraIcon,
  CheckCircle2Icon,
  FlashlightIcon,
  KeyboardIcon,
  RefreshCwIcon,
  SendIcon,
  SmartphoneIcon
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { WebAuthScreen } from "@/components/web-auth-screen";
import { apiFetch, isUnauthorizedApiError } from "@/lib/api";
import { useStoredToken } from "@/lib/session";

type BarcodeDetection = { rawValue?: string };
type BarcodeDetectorInstance = {
  detect(source: HTMLVideoElement): Promise<BarcodeDetection[]>;
};
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

type QueuedObservation = {
  clientObservationId: string;
  scannedPayload: string;
  activeSpatialNodeId: string;
  scanSource: ScanSource;
  deviceHint: string;
  clientObservedAt: string;
};

type StoredCampaignRun = {
  campaignId: string;
  activeNodeId: string | null;
  queue: QueuedObservation[];
  campaignSnapshot: InventoryCampaignDetail | null;
  updatedAt: string;
};

type FeedbackKind = "success" | "warning" | "destructive" | "info";
type Feedback = {
  kind: FeedbackKind;
  title: string;
  detail: string;
};

const DB_NAME = "inventory-terrain-v1";
const DB_VERSION = 1;
const STORE_NAME = "campaign-runs";
const DUPLICATE_SCAN_DELAY_MS = 700;

function openRunDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "campaignId" });
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function readStoredRun(campaignId: string) {
  if (!("indexedDB" in window)) {
    return null;
  }
  const db = await openRunDb();
  return new Promise<StoredCampaignRun | null>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(campaignId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result as StoredCampaignRun | undefined) ?? null);
  }).finally(() => db.close());
}

async function writeStoredRun(state: StoredCampaignRun) {
  if (!("indexedDB" in window)) {
    return;
  }
  const db = await openRunDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(state);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  }).finally(() => db.close());
}

function feedbackStatus(kind: FeedbackKind) {
  if (kind === "success") return "success";
  if (kind === "warning") return "warning";
  if (kind === "destructive") return "destructive";
  return "neutral";
}

function resultFeedback(result: string): FeedbackKind {
  if (result === "MATCH") return "success";
  if (result === "UNKNOWN_CODE") return "destructive";
  return "warning";
}

function playTone(kind: FeedbackKind) {
  try {
    const AudioContextConstructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    const audio = new AudioContextConstructor();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.frequency.value = kind === "success" ? 880 : kind === "warning" ? 520 : 220;
    gain.gain.value = 0.05;
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      void audio.close();
    }, 120);
  } catch {
    // Audio feedback is optional.
  }
}

function vibrate(kind: FeedbackKind) {
  if (!("vibrate" in navigator)) return;
  const pattern = kind === "success" ? 40 : kind === "warning" ? [60, 40, 60] : [120, 50, 120];
  navigator.vibrate(pattern);
}

function expectedItemMatchesActiveNode(
  item: InventoryCampaignDetail["expectedItems"][number],
  activeNodeReference: string | null
) {
  const reference = activeNodeReference?.trim();
  if (!reference) return false;
  if (item.expectedSpatialNodeId === reference) return true;
  const expectedPath = item.expectedSpatialPath?.trim();
  if (!expectedPath) return false;
  if (expectedPath === reference || expectedPath.startsWith(`${reference}/`)) return true;
  const expectedSegments = expectedPath.split("/").filter(Boolean);
  return expectedSegments[expectedSegments.length - 1] === reference;
}

export default function CampaignRunPage() {
  const token = useStoredToken();
  const router = useRouter();
  const params = useParams<{ campaignId: string }>();
  const campaignId = params.campaignId;
  const [campaign, setCampaign] = useState<InventoryCampaignDetail | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueuedObservation[]>([]);
  const [lastSync, setLastSync] = useState<InventoryCampaignSyncResponse | null>(null);
  const [lastComplete, setLastComplete] = useState<CompleteInventoryNodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [scanMode, setScanMode] = useState<ScanSource>("CAMERA");
  const [hidPayload, setHidPayload] = useState("");
  const [manualPayload, setManualPayload] = useState("");
  const [cameraStatus, setCameraStatus] = useState("Camera non initialisee");
  const [isCameraPaused, setIsCameraPaused] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCompletingNode, setIsCompletingNode] = useState(false);
  const [cameraTrack, setCameraTrack] = useState<MediaStreamTrack | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const activeNodeIdRef = useRef<string | null>(null);
  const queueRef = useRef<QueuedObservation[]>([]);
  const campaignRef = useRef<InventoryCampaignDetail | null>(null);
  const lastScanRef = useRef<{ payload: string; source: ScanSource; at: number } | null>(null);
  const handleScanRef = useRef<(payload: string, source: ScanSource) => void>(() => undefined);

  useEffect(() => {
    activeNodeIdRef.current = activeNodeId;
  }, [activeNodeId]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    campaignRef.current = campaign;
  }, [campaign]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const online = () => {
      setIsOnline(true);
      if (queueRef.current.length > 0) {
        void syncQueue(queueRef.current);
      }
    };
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", online);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", online);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadCampaign();
    void readStoredRun(campaignId)
      .then((stored) => {
        if (!stored) return;
        setActiveNodeId(stored.activeNodeId);
        setQueue(stored.queue);
        if (stored.campaignSnapshot) {
          setCampaign(stored.campaignSnapshot);
        }
      })
      .catch(() => setError("Impossible de relire la file offline locale"));
  }, [campaignId, token]);

  useEffect(() => {
    if (scanMode !== "CAMERA") {
      setCameraStatus("Camera en pause");
      cameraTrack?.stop();
      setCameraTrack(null);
      return;
    }
    let stopped = false;
    let stream: MediaStream | null = null;
    let detector: BarcodeDetectorInstance | null = null;
    let zxingControls: { stop: () => void } | null = null;
    let pauseUntil = 0;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraStatus("Camera non disponible sur ce navigateur");
        return;
      }
      if (!window.BarcodeDetector) {
        try {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const video = videoRef.current;
          if (!video) return;
          const reader = new BrowserMultiFormatReader();
          zxingControls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
            if (stopped || !result) return;
            const payload = result.getText();
            if (!payload || Date.now() < pauseUntil) return;
            pauseUntil = Date.now() + 1200;
            setIsCameraPaused(true);
            handleScanRef.current(payload, "CAMERA");
            setTimeout(() => setIsCameraPaused(false), 700);
          });
          setCameraStatus("Camera active via ZXing - placez le code dans le cadre");
          return;
        } catch {
          setCameraStatus("Decodeur camera indisponible. Utiliser Douchette ou Manuel.");
          return;
        }
      }
      try {
        detector = new window.BarcodeDetector({ formats: ["code_128"] });
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" }
          },
          audio: false
        });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const [track] = stream.getVideoTracks();
        setCameraTrack(track ?? null);
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setCameraStatus("Camera active - placez le code dans le cadre");
        const loop = async () => {
          if (stopped || !detector || !videoRef.current) return;
          if (Date.now() >= pauseUntil && videoRef.current.readyState >= 2) {
            try {
              const detections = await detector.detect(videoRef.current);
              const payload = detections.find((detection) => detection.rawValue)?.rawValue;
              if (payload) {
                pauseUntil = Date.now() + 1200;
                setIsCameraPaused(true);
                handleScanRef.current(payload, "CAMERA");
                setTimeout(() => setIsCameraPaused(false), 700);
              }
            } catch {
              setCameraStatus("Lecture camera interrompue. Reessayez ou passez en mode douchette.");
            }
          }
          window.requestAnimationFrame(loop);
        };
        window.requestAnimationFrame(loop);
      } catch (cameraError) {
        setCameraStatus(cameraError instanceof Error ? cameraError.message : "Autorisation camera refusee");
      }
    }

    void startCamera();
    return () => {
      stopped = true;
      zxingControls?.stop();
      stream?.getTracks().forEach((track) => track.stop());
      setCameraTrack(null);
    };
  }, [scanMode]);

  if (!token) {
    return <WebAuthScreen />;
  }

  async function loadCampaign() {
    try {
      const detail = await apiFetch<InventoryCampaignDetail>(`/inventory-campaigns/${campaignId}`);
      setCampaign(detail);
      setError(null);
      await persistRunState(queueRef.current, activeNodeIdRef.current, detail);
    } catch (loadError) {
      if (!isUnauthorizedApiError(loadError)) {
        setError(loadError instanceof Error ? loadError.message : "Campagne introuvable");
      }
    }
  }

  async function persistRunState(
    nextQueue: QueuedObservation[],
    nextActiveNodeId = activeNodeIdRef.current,
    nextCampaign = campaignRef.current
  ) {
    await writeStoredRun({
      campaignId,
      activeNodeId: nextActiveNodeId,
      queue: nextQueue,
      campaignSnapshot: nextCampaign,
      updatedAt: new Date().toISOString()
    });
  }

  function applyFeedback(nextFeedback: Feedback) {
    setFeedback(nextFeedback);
    playTone(nextFeedback.kind);
    vibrate(nextFeedback.kind);
  }

  function updateQueue(nextQueue: QueuedObservation[]) {
    queueRef.current = nextQueue;
    setQueue(nextQueue);
    void persistRunState(nextQueue);
  }

  function setActiveNode(nextNodeId: string) {
    if (queueRef.current.length > 0 && activeNodeIdRef.current && activeNodeIdRef.current !== nextNodeId) {
      const confirmed = window.confirm(
        "Des observations ne sont pas encore synchronisees. Changer de noeud maintenant les conserve dans la file. Continuer ?"
      );
      if (!confirmed) {
        return;
      }
    }
    activeNodeIdRef.current = nextNodeId;
    setActiveNodeId(nextNodeId);
    void persistRunState(queueRef.current, nextNodeId);
    setError(null);
    applyFeedback({
      kind: "info",
      title: "Noeud actif",
      detail: nextNodeId
    });
  }

  async function syncQueue(items = queueRef.current) {
    if (items.length === 0 || isSyncing) {
      return true;
    }
    setIsSyncing(true);
    const payload: InventoryCampaignSyncInput = {
      clientBatchId: crypto.randomUUID(),
      activeSpatialNodeId: items[0]?.activeSpatialNodeId ?? activeNodeIdRef.current,
      observations: items.map((item) => ({
        clientObservationId: item.clientObservationId,
        scannedPayload: item.scannedPayload,
        activeSpatialNodeId: item.activeSpatialNodeId,
        scanSource: item.scanSource,
        deviceHint: item.deviceHint,
        clientObservedAt: item.clientObservedAt,
        observedAt: item.clientObservedAt
      }))
    };
    try {
      const response = await apiFetch<InventoryCampaignSyncResponse>(`/inventory-campaigns/${campaignId}/sync`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setLastSync(response);
      const syncedIds = new Set(items.map((item) => item.clientObservationId));
      const remaining = queueRef.current.filter((item) => !syncedIds.has(item.clientObservationId));
      updateQueue(remaining);
      const lastObservation = response.observations[response.observations.length - 1];
      if (lastObservation) {
        const kind = resultFeedback(lastObservation.result);
        applyFeedback({
          kind,
          title: lastObservation.result,
          detail: lastObservation.equipmentInternalCode ?? lastObservation.scannedCode ?? lastObservation.scannedPayload
        });
      }
      setError(null);
      void loadCampaign();
      return true;
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Observation mise en file offline");
      applyFeedback({
        kind: "info",
        title: "Observation en attente",
        detail: "La synchronisation sera relancee a la reconnexion."
      });
      return false;
    } finally {
      setIsSyncing(false);
    }
  }

  function enqueueEquipmentScan(scannedPayload: string, source: ScanSource) {
    const activeSpatialNodeId = activeNodeIdRef.current;
    if (!activeSpatialNodeId) {
      setError("Scanne d abord une etiquette noeud NODE:<id>");
      applyFeedback({
        kind: "destructive",
        title: "Noeud obligatoire",
        detail: "Le scan equipement est bloque tant que le noeud actif n est pas defini."
      });
      return;
    }
    const item: QueuedObservation = {
      clientObservationId: crypto.randomUUID(),
      scannedPayload,
      activeSpatialNodeId,
      scanSource: source,
      deviceHint: navigator.userAgent.slice(0, 160),
      clientObservedAt: new Date().toISOString()
    };
    const nextQueue = [...queueRef.current, item];
    updateQueue(nextQueue);
    applyFeedback({
      kind: "info",
      title: "Observation captee",
      detail: scannedPayload
    });
    if (navigator.onLine) {
      void syncQueue(nextQueue);
    }
  }

  handleScanRef.current = (payload: string, source: ScanSource) => {
    const normalizedPayload = payload.trim();
    if (!normalizedPayload) return;
    const lastScan = lastScanRef.current;
    const now = Date.now();
    if (
      lastScan &&
      lastScan.payload === normalizedPayload &&
      lastScan.source === source &&
      now - lastScan.at < DUPLICATE_SCAN_DELAY_MS
    ) {
      return;
    }
    lastScanRef.current = {
      payload: normalizedPayload,
      source,
      at: now
    };
    const parsed = parseScanPayload(normalizedPayload);
    if (parsed.kind === "NODE" && parsed.value) {
      setActiveNode(parsed.value);
      return;
    }
    if (parsed.kind === "EQUIPMENT") {
      enqueueEquipmentScan(parsed.rawPayload, source);
      return;
    }
    setError("Payload invalide. Attendu : NODE:<noeud> ou EQ:<code equipement>");
    applyFeedback({
      kind: "destructive",
      title: "Code invalide",
      detail: normalizedPayload
    });
  };

  function submitManual() {
    const value = manualPayload.trim();
    if (!value) return;
    const hasExplicitPrefix = value.startsWith("NODE:") || value.startsWith("EQ:");
    const looksLikeSpatialPath = value.includes("/");
    const payload = hasExplicitPrefix ? value : looksLikeSpatialPath || !activeNodeId ? `NODE:${value}` : `EQ:${value}`;
    setManualPayload("");
    handleScanRef.current(payload, "MANUAL");
  }

  function submitHid(payload: string) {
    const value = payload.trim();
    if (!value) return;
    setHidPayload("");
    handleScanRef.current(value, "HID");
  }

  async function completeNode() {
    if (!activeNodeIdRef.current) {
      setError("Noeud actif obligatoire pour terminer une piece");
      return;
    }
    if (queueRef.current.length > 0) {
      const synced = await syncQueue(queueRef.current);
      if (!synced || queueRef.current.length > 0) {
        setError("Synchronise la file offline avant de terminer la piece");
        return;
      }
    }
    setIsCompletingNode(true);
    try {
      const response = await apiFetch<CompleteInventoryNodeResult>(`/inventory-campaigns/${campaignId}/complete-node`, {
        method: "POST",
        body: JSON.stringify({
          spatialNodeId: activeNodeIdRef.current
        })
      });
      setLastComplete(response);
      applyFeedback({
        kind: "success",
        title: "Piece terminee",
        detail: `${response.missingCreated} manquant(s) cree(s), ${response.missingAlreadyExisting} deja existant(s)`
      });
      setError(null);
      void loadCampaign();
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : "Impossible de terminer la piece");
    } finally {
      setIsCompletingNode(false);
    }
  }

  async function toggleTorch() {
    if (!cameraTrack) return;
    const capabilities = cameraTrack.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
    if (!capabilities?.torch) {
      setCameraStatus("Torche non supportee sur cet appareil");
      return;
    }
    const settings = cameraTrack.getSettings() as MediaTrackSettings & { torch?: boolean };
    await cameraTrack.applyConstraints({
      advanced: [{ torch: !settings.torch } as MediaTrackConstraintSet]
    });
  }

  const activeExpected = campaign?.expectedItems.filter((item) => expectedItemMatchesActiveNode(item, activeNodeId)) ?? [];
  const seenInActiveNode = activeExpected.filter((item) => item.isSeen).length;
  const latestObservations = lastSync?.observations ?? campaign?.observations.slice(0, 8) ?? [];

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 bg-card/70 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Execution terrain</p>
            <h1 className="font-heading text-2xl font-semibold text-foreground">{campaign?.name ?? "Campagne"}</h1>
            <p className="text-sm text-muted-foreground">Scanner le noeud puis les equipements presents.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={isOnline ? "success" : "warning"} label={isOnline ? "Online" : "Offline"} />
            <Button variant="outline" onClick={() => router.push("/campaigns")}>
              <ArrowLeftIcon className="size-4" />
              Retour
            </Button>
          </div>
        </div>

        {error ? <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-3xl border border-border/70 bg-card/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">Mode</p>
            <p className="mt-2 text-lg font-semibold">{scanMode}</p>
          </div>
          <div className="rounded-3xl border border-border/70 bg-card/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">Noeud actif</p>
            <p className="mt-2 break-all font-mono text-sm">{activeNodeId ?? "-"}</p>
          </div>
          <div className="rounded-3xl border border-border/70 bg-card/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">File offline</p>
            <p className="mt-2 text-lg font-semibold">{queue.length}</p>
          </div>
          <div className="rounded-3xl border border-border/70 bg-card/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">Attendus piece</p>
            <p className="mt-2 text-lg font-semibold">
              {seenInActiveNode}/{activeExpected.length}
            </p>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <PageSection title="Scan" description="Camera prioritaire, douchette Bluetooth HID ou saisie manuelle.">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant={scanMode === "CAMERA" ? "default" : "outline"} onClick={() => setScanMode("CAMERA")}>
                  <CameraIcon className="size-4" />
                  Camera
                </Button>
                <Button variant={scanMode === "HID" ? "default" : "outline"} onClick={() => setScanMode("HID")}>
                  <BluetoothIcon className="size-4" />
                  Douchette
                </Button>
                <Button variant={scanMode === "MANUAL" ? "default" : "outline"} onClick={() => setScanMode("MANUAL")}>
                  <KeyboardIcon className="size-4" />
                  Manuel
                </Button>
              </div>

              {scanMode === "CAMERA" ? (
                <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-slate-950 text-white">
                  <div className="relative aspect-[4/3]">
                    <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
                    <div className="absolute inset-8 rounded-3xl border-4 border-primary/80 shadow-[0_0_0_999px_rgba(15,23,42,0.35)]" />
                    <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-2">
                      <StatusBadge status={isCameraPaused ? "warning" : "success"} label={isCameraPaused ? "Pause lecture" : "Camera"} />
                      <Button variant="outline" onClick={() => void toggleTorch()}>
                        <FlashlightIcon className="size-4" />
                        Torche
                      </Button>
                    </div>
                    <p className="absolute bottom-4 left-4 right-4 rounded-2xl bg-black/60 p-3 text-sm">{cameraStatus}</p>
                  </div>
                </div>
              ) : null}

              {scanMode === "HID" ? (
                <div className="rounded-3xl border border-border/70 p-4">
                  <p className="mb-3 text-sm text-muted-foreground">
                    Connecter la douchette au telephone en Bluetooth, mode clavier HID, puis scanner dans ce champ.
                  </p>
                  <Field label="Capture douchette">
                    <Input
                      autoFocus
                      value={hidPayload}
                      onChange={(event) => setHidPayload(event.target.value)}
                      placeholder="Scanner NODE:<id> ou EQ:<code>"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === "Tab") {
                          event.preventDefault();
                          submitHid(hidPayload);
                        }
                      }}
                    />
                  </Field>
                </div>
              ) : null}

              {scanMode === "MANUAL" ? (
                <div className="rounded-3xl border border-border/70 p-4">
                  <p className="mb-3 text-sm text-muted-foreground">
                    Saisir `NODE:&lt;uuid, code, chemin ou reference externe&gt;` pour un noeud ou `EQ:&lt;code interne, reference
                    externe ou num piece&gt;` pour un equipement. Si le prefixe manque, l ecran deduit le type selon le noeud actif.
                  </p>
                  <Field label="Saisie manuelle">
                    <Input
                      value={manualPayload}
                      onChange={(event) => setManualPayload(event.target.value)}
                      placeholder={activeNodeId ? "AST-001, REF-001 ou EQ:AST-001" : "NODE:<code ou reference noeud>"}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          submitManual();
                        }
                      }}
                    />
                  </Field>
                  <Button className="mt-3" onClick={submitManual}>
                    <SendIcon className="size-4" />
                    Envoyer
                  </Button>
                </div>
              ) : null}

              {feedback ? (
                <div className="rounded-3xl border border-border/70 bg-card/80 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={feedbackStatus(feedback.kind)} label={feedback.title} />
                    <p className="break-all text-sm text-muted-foreground">{feedback.detail}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </PageSection>

          <PageSection title="Pilotage piece" description="Synchronisation et fin de piece.">
            <div className="space-y-3">
              <Button variant="outline" onClick={() => void syncQueue()} disabled={queue.length === 0 || isSyncing}>
                <RefreshCwIcon className="size-4" />
                {isSyncing ? "Synchronisation..." : `Synchroniser (${queue.length})`}
              </Button>
              <Button onClick={() => void completeNode()} disabled={!activeNodeId || isCompletingNode}>
                <CheckCircle2Icon className="size-4" />
                {isCompletingNode ? "Fin de piece..." : "Terminer cette piece"}
              </Button>
              {lastComplete ? (
                <div className="rounded-2xl border border-border/70 p-3 text-sm text-muted-foreground">
                  Derniere fin de piece : {lastComplete.missingCreated} manquant(s) cree(s),{" "}
                  {lastComplete.missingAlreadyExisting} deja existant(s).
                </div>
              ) : null}
              <div className="rounded-2xl border border-border/70 p-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Aide douchette</p>
                <p>1. Associer la douchette au smartphone en Bluetooth.</p>
                <p>2. Configurer la douchette en mode clavier HID.</p>
                <p>3. Ouvrir cet ecran, choisir Douchette, puis scanner.</p>
              </div>
            </div>
          </PageSection>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <PageSection title="Attendus du noeud actif" description="Equipements attendus dans la piece ou zone scannee.">
            <div className="space-y-2">
              {activeExpected.slice(0, 12).map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 p-3">
                  <div>
                    <p className="font-medium">{item.internalCode}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.label} - {item.expectedSpatialPath ?? "-"}
                    </p>
                  </div>
                  <StatusBadge status={item.isSeen ? "success" : "neutral"} label={item.isSeen ? "Vu" : "Attendu"} />
                </div>
              ))}
              {activeNodeId && activeExpected.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun equipement attendu exactement sur ce noeud.</p>
              ) : null}
              {!activeNodeId ? <p className="text-sm text-muted-foreground">Scanner un noeud pour afficher ses attendus.</p> : null}
            </div>
          </PageSection>

          <PageSection title="Derniers resultats" description="Retour du moteur apres synchronisation.">
            <div className="space-y-2">
              {latestObservations.map((observation) => (
                <div key={observation.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 p-3">
                  <div>
                    <p className="font-medium">{observation.scannedPayload}</p>
                    <p className="text-sm text-muted-foreground">
                      {observation.equipmentInternalCode ?? observation.scannedCode ?? "-"} - {observation.scanSource ?? "source inconnue"}
                    </p>
                  </div>
                  <StatusBadge status={observation.result === "MATCH" ? "success" : "warning"} label={observation.result} />
                </div>
              ))}
              {latestObservations.length === 0 ? <p className="text-sm text-muted-foreground">Aucun resultat synchronise.</p> : null}
            </div>
          </PageSection>
        </div>

        <div className="rounded-3xl border border-border/70 bg-card/70 p-4 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2 font-medium text-foreground">
            <SmartphoneIcon className="size-4" />
            Mode terrain V1
          </div>
          <p className="mt-2">
            Le serveur decide toujours du resultat. La page conserve les scans localement si le reseau tombe, puis les
            synchronise avec des identifiants idempotents.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
