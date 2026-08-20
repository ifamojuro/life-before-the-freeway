export type EraKey = "1950" | "1965" | "1985";

export interface Era {
  key: EraKey;
  year: string;
  label: string;
  detail: string;
}

export const ERAS: Era[] = [
  { key: "1950", year: "~1950", label: "Before the freeway", detail: "The full pre-freeway neighborhood." },
  { key: "1965", year: "1965", label: "The takings", detail: "Homes cleared — “a giant scar.”" },
  { key: "1985", year: "1985", label: "Freeway opens / today", detail: "The neighborhood after I-980." },
];

export const ERA_SHORT: Record<EraKey, string> = { "1950": "before", "1965": "the scar", "1985": "today" };

export interface LocationPin {
  id: number;
  name: string;
  cross_street: string;
  lat: number;
  lng: number;
  eras: EraKey[];
  story_count: number;
}

export interface Story {
  id: number;
  location_id: number;
  contributor_name: string;
  contributor_detail: string;
  initials: string;
  avatar_color: string;
  video_url: string | null;
  start_s: number | null;
  end_s: number | null;
  duration_s: number;
  caption: string;
  era: EraKey;
  era_label: string;
  source: string;
  published_at: string;
}

export interface Comment {
  id: number;
  author: string;
  text: string;
  created_at: string;
}

export interface LocationDetail {
  id: number;
  name: string;
  cross_street: string;
  lat: number;
  lng: number;
  eras: EraKey[];
  era_range: string;
  stories: Story[];
  comments: Comment[];
}

export interface Prompt {
  id: number;
  text: string;
}

export interface Citation {
  story_id: number;
  location_id: number;
  location_name: string;
  cross_street: string;
  contributor_name: string;
  era_label: string;
  excerpt: string;
}

export interface ChatAnswer {
  answer: string;
  citations: Citation[];
  mode: "claude" | "extractive";
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  pending?: boolean;
}

export interface DetectedPlace {
  name: string;
  source: "transcript" | "manual";
  lat: number | null;
  lng: number | null;
  location_id: number | null;
  confidence?: number;
}

export interface UploadResult {
  upload_id: number;
  video_url: string;
  original_name: string;
  size_bytes: number;
  duration_s: number;
  transcript: string;
  segments: { start: number; end: number; text: string }[];
  flagged_terms: { term: string; at_s: number; context: string }[];
  detected_places: DetectedPlace[];
}

export interface SubmissionIn {
  upload_id: number;
  prompt_id: number | null;
  contributor_name: string;
  contributor_email: string;
  contributor_detail?: string;
  places: DetectedPlace[];
  eras: EraKey[];
  agreed_norms: boolean;
  own_footage: boolean;
}

export interface SubmissionCreated {
  id: number;
  status: string;
  message: string;
}

// ---- admin ----

export interface Staff {
  id: number;
  name: string;
  email: string;
  role: string;
  color: string;
  active: boolean;
}

export interface Association {
  id?: string | null;
  start_s: number;
  end_s: number;
  location_id: number | null;
  name: string;
  sub: string;
  lat: number | null;
  lng: number | null;
  era: EraKey | null;
  color: string;
}

export interface SubmissionCard {
  id: number;
  primary_label: string;
  contributor_name: string;
  source: string;
  method: string;
  video_url: string | null;
  duration_s: number;
  flag_count: number;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewer_name: string | null;
}

export interface Queue {
  counts: Record<string, number>;
  items: SubmissionCard[];
}

export interface SubmissionDetail {
  id: number;
  primary_label: string;
  contributor_name: string;
  contributor_email: string;
  contributor_detail: string;
  prompt_text: string;
  source: string;
  method: string;
  video_url: string | null;
  duration_s: number;
  transcript: string;
  segments: { start: number; end: number; text: string }[];
  flagged_terms: { term: string; at_s: number; context: string }[];
  eras: EraKey[];
  places: DetectedPlace[];
  associations: Association[];
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewer_name: string | null;
  reject_reason: string;
  prev_id: number | null;
  next_id: number | null;
}

export interface AuditEntry {
  id: number;
  submission_id: number | null;
  submission_label: string;
  action: string;
  reviewer_name: string;
  detail: string;
  at: string;
}

export interface PublishedStory {
  id: number;
  location_id: number;
  location_name: string;
  cross_street: string;
  contributor_name: string;
  era_label: string;
  source: string;
  video_url: string | null;
  duration_s: number;
  published_at: string;
}

export interface GazetteerEntry {
  id: number;
  name: string;
  cross_street: string;
  lat: number;
  lng: number;
  eras: EraKey[];
}
