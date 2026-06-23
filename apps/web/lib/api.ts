import type {
  AuthenticatedLoginResponse,
  CompletePasswordChangeInput,
  LoginResponse
} from "@inventory/shared";

function normalizeApiBaseUrl(value: string | undefined) {
  const normalized = (value ?? "http://localhost:3011/api/v1").trim().replace(/\/+$/, "");
  if (normalized.endsWith("/api/v1")) {
    return normalized;
  }
  if (normalized.endsWith("/api")) {
    return `${normalized}/v1`;
  }
  return `${normalized}/api/v1`;
}

export const API_BASE_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);
export const ACCESS_TOKEN_KEY = "inventory.web.access-token";
export const TOKEN_STORAGE_EVENT = "inventory.web.token-storage-change";

export interface LoginInput {
  organizationSlug: string;
  email: string;
  password: string;
}

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function buildNetworkError() {
  return new ApiError(
    0,
    `Impossible de joindre l API (${API_BASE_URL}). Verifier que le serveur API est demarre et accessible.`,
    null
  );
}

function notifyTokenChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TOKEN_STORAGE_EVENT));
  }
}

function translateConstraint(message: string) {
  const normalized = message.trim();

  if (normalized.endsWith("must be a UUID")) {
    return "identifiant invalide";
  }
  if (normalized.endsWith("must be an email")) {
    return "adresse email invalide";
  }
  if (normalized.endsWith("must be a string")) {
    return "valeur texte invalide";
  }
  if (normalized.endsWith("must be a boolean value")) {
    return "valeur booleenne invalide";
  }
  if (normalized.endsWith("should not be empty")) {
    return "champ obligatoire";
  }

  const minLengthMatch = normalized.match(/must be longer than or equal to (\d+) characters/);
  if (minLengthMatch) {
    return `doit contenir au moins ${minLengthMatch[1]} caracteres`;
  }

  const maxLengthMatch = normalized.match(/must be shorter than or equal to (\d+) characters/);
  if (maxLengthMatch) {
    return `doit contenir au maximum ${maxLengthMatch[1]} caracteres`;
  }

  return normalized;
}

function formatFieldLabel(path: string) {
  const match = path.match(/^roleAssignments\.(\d+)\.(.+)$/);
  if (match) {
    const index = Number(match[1]) + 1;
    const field = match[2];
    if (field === "roleId") {
      return `Habilitation ${index} - Role`;
    }
    if (field === "scopeId") {
      return `Habilitation ${index} - Perimetre`;
    }
    return `Habilitation ${index}`;
  }

  const labels: Record<string, string> = {
    email: "Email",
    password: "Mot de passe",
    temporaryPassword: "Mot de passe temporaire",
    newPassword: "Nouveau mot de passe",
    name: "Nom",
    roleAssignments: "Habilitations",
    roleId: "Role",
    scopeId: "Perimetre",
    organizationSlug: "Organisation"
  };

  return labels[path] ?? path;
}

function formatValidationMessage(message: string) {
  const firstSpace = message.indexOf(" ");
  if (firstSpace <= 0) {
    return translateConstraint(message);
  }

  const fieldPath = message.slice(0, firstSpace);
  const constraint = message.slice(firstSpace + 1);
  const translatedConstraint = translateConstraint(constraint);
  const translatedField = formatFieldLabel(fieldPath);
  return `${translatedField} : ${translatedConstraint}`;
}

function extractMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload;
  }

  if (payload && typeof payload === "object" && "message" in payload) {
    if (typeof payload.message === "string" && payload.message.trim().length > 0) {
      return payload.message;
    }

    if (Array.isArray(payload.message)) {
      const messages = payload.message.filter(
        (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
      );
      if (messages.length > 0) {
        return messages.map((entry) => formatValidationMessage(entry)).join(" | ");
      }
    }
  }

  return fallback;
}

async function buildApiError(response: Response) {
  const fallback = `API error ${response.status}`;
  const rawPayload = await response.text();

  if (!rawPayload) {
    return new ApiError(response.status, fallback, null);
  }

  try {
    const parsedPayload = JSON.parse(rawPayload) as unknown;
    return new ApiError(response.status, extractMessage(parsedPayload, fallback), parsedPayload);
  } catch {
    return new ApiError(response.status, extractMessage(rawPayload, fallback), rawPayload);
  }
}

function handleUnauthorized(status: number) {
  if (status === 401) {
    clearStoredToken();
  }
}

export function getStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setStoredToken(token: string) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    notifyTokenChange();
  }
}

export function clearStoredToken() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    notifyTokenChange();
  }
}

export function isUnauthorizedApiError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 401;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {})
      },
      cache: "no-store"
    });
  } catch (error) {
    throw error instanceof ApiError ? error : buildNetworkError();
  }

  if (!response.ok) {
    handleUnauthorized(response.status);
    throw await buildApiError(response);
  }

  return response.json() as Promise<T>;
}

export async function apiUpload<T>(path: string, formData: FormData, init?: Omit<RequestInit, "body">): Promise<T> {
  const token = getStoredToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      method: init?.method ?? "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {})
      },
      body: formData,
      cache: "no-store"
    });
  } catch (error) {
    throw error instanceof ApiError ? error : buildNetworkError();
  }

  if (!response.ok) {
    handleUnauthorized(response.status);
    throw await buildApiError(response);
  }

  return response.json() as Promise<T>;
}

export async function login(input: LoginInput) {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });
  } catch (error) {
    throw error instanceof ApiError ? error : buildNetworkError();
  }

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return response.json() as Promise<LoginResponse>;
}

export async function completePasswordChange(input: CompletePasswordChangeInput) {
  return apiFetch<AuthenticatedLoginResponse>("/auth/complete-password-change", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function apiDownload(path: string) {
  const token = getStoredToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      cache: "no-store"
    });
  } catch (error) {
    throw error instanceof ApiError ? error : buildNetworkError();
  }

  if (!response.ok) {
    handleUnauthorized(response.status);
    throw await buildApiError(response);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition");
  const filenameMatch = disposition?.match(/filename="([^"]+)"/);
  const filename = filenameMatch?.[1] ?? "export.ods";
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export async function apiDownloadPost(path: string, payload: unknown, fallbackFilename = "export.bin") {
  const token = getStoredToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload),
      cache: "no-store"
    });
  } catch (error) {
    throw error instanceof ApiError ? error : buildNetworkError();
  }

  if (!response.ok) {
    handleUnauthorized(response.status);
    throw await buildApiError(response);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition");
  const filenameMatch = disposition?.match(/filename="([^"]+)"/);
  const filename = filenameMatch?.[1] ?? fallbackFilename;
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
