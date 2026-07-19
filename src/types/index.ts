export type Song = {
  id: string;
  title: string;
  artist?: string;
  bpm?: number;
  key?: string;
  durationSeconds?: number;
  fileName: string;
  fileSize?: number;
  fileType?: string;
  storageKey: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  defaultVolume: number;
  isAvailableOffline: boolean;
  validationStatus: "pending" | "valid" | "invalid" | "missing";
};

export type Setlist = {
  id: string;
  name: string;
  eventName?: string;
  eventDate?: string;
  notes?: string;
  songIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type PlaybackStatus =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "stopped"
  | "ended"
  | "error";

export type PlaybackState = {
  selectedSetlistId: string | null;
  currentSongId: string | null;
  currentIndex: number;
  status: PlaybackStatus;
  currentTime: number;
  duration: number;
  startedAtAudioTime: number | null;
  pausedAtSeconds: number;
  errorMessage?: string;
};
