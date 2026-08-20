import type {
  Association, AuditEntry, ChatAnswer, ChatMessage, Comment, DetectedPlace, EraKey, GazetteerEntry, LocationDetail,
  LocationPin, Prompt, PublishedStory, Queue, Staff, SubmissionCreated, SubmissionDetail, SubmissionIn, UploadResult,
} from "./types";

const TOKEN_KEY = "lbtf.admin.token";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  if (!(init.body instanceof FormData) && init.body) headers["Content-Type"] = "application/json";
  if (auth) {
    const t = getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(path, { ...init, headers });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = (data && (data.detail?.[0]?.msg || data.detail)) || res.statusText;
    throw new ApiError(res.status, typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as T;
}

export const api = {
  // public
  pins: (era?: EraKey | null) => request<LocationPin[]>(`/api/locations${era ? `?era=${era}` : ""}`),
  location: (id: number | string) => request<LocationDetail>(`/api/locations/${id}`),
  addComment: (id: number, author: string, text: string) =>
    request<Comment>(`/api/locations/${id}/comments`, { method: "POST", body: JSON.stringify({ author, text }) }),
  randomPrompt: (exclude?: number | null) =>
    request<Prompt>(`/api/prompts/random${exclude ? `?exclude=${exclude}` : ""}`),
  prompts: () => request<Prompt[]>("/api/prompts"),
  chat: (question: string, history: ChatMessage[]) =>
    request<ChatAnswer>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ question, history: history.map((h) => ({ role: h.role, content: h.content })) }),
    }),

  // contributor
  upload: (file: Blob, method: "recorded" | "uploaded", durationS?: number, filename = "clip.webm") => {
    const fd = new FormData();
    fd.append("file", file, (file as File).name || filename);
    fd.append("method", method);
    if (durationS && isFinite(durationS)) fd.append("duration_s", String(durationS));
    return request<UploadResult>("/api/submissions/upload", { method: "POST", body: fd });
  },
  submit: (body: SubmissionIn) => request<SubmissionCreated>("/api/submissions", { method: "POST", body: JSON.stringify(body) }),

  // admin
  login: (email: string, password: string) =>
    request<{ token: string; staff: Staff }>("/api/admin/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<void>("/api/admin/logout", { method: "POST" }, true),
  me: () => request<Staff>("/api/admin/me", {}, true),
  queue: (status: string, q = "", sort = "oldest") =>
    request<Queue>(`/api/admin/submissions?status=${status}&q=${encodeURIComponent(q)}&sort=${sort}`, {}, true),
  submission: (id: number | string) => request<SubmissionDetail>(`/api/admin/submissions/${id}`, {}, true),
  saveAssociations: (id: number, associations: Association[]) =>
    request<SubmissionDetail>(`/api/admin/submissions/${id}/associations`, { method: "PUT", body: JSON.stringify({ associations }) }, true),
  approve: (id: number, associations?: Association[]) =>
    request<SubmissionDetail>(`/api/admin/submissions/${id}/approve`, { method: "POST", body: JSON.stringify({ associations }) }, true),
  reject: (id: number, reason: string, associations?: Association[]) =>
    request<SubmissionDetail>(`/api/admin/submissions/${id}/reject`, { method: "POST", body: JSON.stringify({ reason, associations }) }, true),
  fieldCapture: (body: {
    upload_id: number; contributor_name: string; contributor_detail: string; prompt_id: number | null;
    places: DetectedPlace[]; eras: EraKey[]; associations: Association[];
  }) => request<SubmissionCreated>("/api/admin/field-capture", { method: "POST", body: JSON.stringify(body) }, true),
  published: () => request<PublishedStory[]>("/api/admin/stories", {}, true),
  unpublish: (id: number) => request<void>(`/api/admin/stories/${id}`, { method: "DELETE" }, true),
  audit: (limit = 50) => request<AuditEntry[]>(`/api/admin/audit?limit=${limit}`, {}, true),
  staff: () => request<Staff[]>("/api/admin/staff", {}, true),
  gazetteer: () => request<GazetteerEntry[]>("/api/admin/locations", {}, true),
};
