import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { DetectedPlace, EraKey, Prompt, SubmissionCreated, UploadResult } from "../../lib/types";
import type { PickedFile } from "../../components/UploadPicker";
import type { Recording } from "../../components/Recorder";

export type Method = "record" | "upload" | null;

export interface PlaceDraft extends DetectedPlace {
  key: string;
}

let keyCounter = 0;
const mkKey = () => `p${Date.now().toString(36)}${(keyCounter++).toString(36)}`;

export function useContributeFlow() {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [method, setMethod] = useState<Method>(null);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [ownFootage, setOwnFootage] = useState(true);
  const [upload, setUpload] = useState<UploadResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [places, setPlaces] = useState<PlaceDraft[]>([]);
  const [eras, setEras] = useState<EraKey[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmissionCreated | null>(null);

  const shufflePrompt = useCallback(async () => {
    try { setPrompt(await api.randomPrompt(prompt?.id)); } catch { /* keep current */ }
  }, [prompt?.id]);

  useEffect(() => {
    api.randomPrompt().then(setPrompt).catch(() => setPrompt({ id: 0, text: "What's the best thing about being Black in West Oakland?" }));
  }, []);

  /** Upload the recorded/picked clip; returns the transcript + detected places. */
  const processVideo = useCallback(async (): Promise<UploadResult | null> => {
    if (upload) return upload;
    const blob = recording?.blob ?? picked?.file;
    if (!blob) return null;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await api.upload(
        blob,
        recording ? "recorded" : "uploaded",
        recording?.durationS ?? picked?.durationS,
        recording ? `recording.${recording.mimeType.includes("mp4") ? "mp4" : "webm"}` : picked?.file.name,
      );
      setUpload(res);
      setPlaces(res.detected_places.map((p) => ({ ...p, key: mkKey() })));
      return res;
    } catch (e) {
      setUploadError((e as Error).message);
      return null;
    } finally {
      setUploading(false);
    }
  }, [upload, recording, picked]);

  const resetVideo = useCallback(() => {
    setUpload(null);
    setPlaces([]);
    setRecording(null);
    setPicked(null);
    setUploadError(null);
  }, []);

  const addPlace = (nm: string) => {
    const n = nm.trim();
    if (!n) return;
    setPlaces((ps) => [...ps, { key: mkKey(), name: n, source: "manual", lat: null, lng: null, location_id: null }]);
  };
  const removePlace = (key: string) => setPlaces((ps) => ps.filter((p) => p.key !== key));
  const setPlaceCoords = (key: string, lat: number, lng: number) =>
    setPlaces((ps) => ps.map((p) => (p.key === key ? { ...p, lat, lng } : p)));
  const renamePlace = (key: string, nm: string) => setPlaces((ps) => ps.map((p) => (p.key === key ? { ...p, name: nm } : p)));
  const toggleEra = (e: EraKey) => setEras((es) => (es.includes(e) ? es.filter((x) => x !== e) : [...es, e]));

  const hasVideo = !!(recording || picked);
  const unmapped = places.filter((p) => p.lat == null || p.lng == null);
  const canSubmit = !!upload && name.trim().length > 0 && agreed && !submitting;

  const submit = useCallback(async () => {
    if (!upload) { setSubmitError("Please add your video first."); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.submit({
        upload_id: upload.upload_id,
        prompt_id: prompt?.id || null,
        contributor_name: name.trim(),
        contributor_email: email.trim(),
        places: places.map(({ key: _k, ...p }) => p),
        eras,
        agreed_norms: agreed,
        own_footage: ownFootage,
      });
      setResult(res);
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [upload, prompt, name, email, places, eras, agreed, ownFootage]);

  return {
    prompt, shufflePrompt,
    method, setMethod,
    recording, setRecording, picked, setPicked, ownFootage, setOwnFootage, hasVideo, resetVideo,
    upload, uploading, uploadError, processVideo,
    places, addPlace, removePlace, setPlaceCoords, renamePlace, unmapped,
    eras, toggleEra,
    name, setName, email, setEmail, agreed, setAgreed,
    canSubmit, submitting, submitError, submit, result,
  };
}

export type ContributeFlow = ReturnType<typeof useContributeFlow>;
