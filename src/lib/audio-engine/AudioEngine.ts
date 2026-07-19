/**
 * AudioEngine class using Web Audio API to handle professional playback.
 * Ensures strict L/R channel separation:
 * Channel 0 (L) = Click, counts, and guides (for in-ears only).
 * Channel 1 (R) = Backing track sequence (for PA and in-ears).
 */

type AudioEngineState = "idle" | "loading" | "ready" | "playing" | "paused" | "stopped" | "ended" | "error";

type AudioEngineListener = {
  onStatusChange?: (status: AudioEngineState) => void;
  onTimeUpdate?: (time: number) => void;
  onError?: (msg: string) => void;
};

export class AudioEngine {
  private static instance: AudioEngine | null = null;
  private ctx: AudioContext | null = null;
  private currentBuffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  
  // Playback state variables
  private status: AudioEngineState = "idle";
  private duration = 0;
  private startedAtAudioContextTime = 0;
  private pausedAtSeconds = 0;
  
  // Listeners
  private listeners: AudioEngineListener = {};
  
  // Interval for updating current time
  private timeUpdateInterval: any = null;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  /**
   * Initializes or returns the AudioContext (must be called after a user interaction)
   */
  public getContext(): AudioContext {
    if (!this.ctx) {
      // @ts-ignore
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio API is not supported in this browser");
      }
      this.ctx = new AudioContextClass();
    }
    return this.ctx;
  }

  /**
   * Register state update listeners
   */
  public setListeners(listeners: AudioEngineListener) {
    this.listeners = listeners;
  }

  private setStatus(newStatus: AudioEngineState) {
    this.status = newStatus;
    if (this.listeners.onStatusChange) {
      this.listeners.onStatusChange(newStatus);
    }
  }

  /**
   * Decodes a File or Blob into an AudioBuffer
   */
  public async decodeAudioFile(file: File | Blob): Promise<AudioBuffer> {
    const ctx = this.getContext();
    this.setStatus("loading");
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      // decodeAudioData consumes the ArrayBuffer, so we don't hold references to it
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      this.setStatus("ready");
      return buffer;
    } catch (err: any) {
      this.setStatus("error");
      const msg = `Error al decodificar audio: ${err?.message || err}`;
      if (this.listeners.onError) {
        this.listeners.onError(msg);
      }
      throw new Error(msg);
    }
  }

  /**
   * Loads an AudioBuffer into the engine
   */
  public loadBuffer(buffer: AudioBuffer) {
    this.stop();
    this.currentBuffer = buffer;
    this.duration = buffer.duration;
    this.pausedAtSeconds = 0;
    this.setStatus("ready");
  }

  /**
   * Starts playback
   */
  public async play(): Promise<void> {
    if (!this.currentBuffer) {
      throw new Error("No hay audio cargado para reproducir");
    }

    const ctx = this.getContext();
    
    // Resume context if suspended (browser security policy)
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    // Stop any existing source node
    this.stopSourceNode();

    // Create new buffer source node
    this.source = ctx.createBufferSource();
    this.source.buffer = this.currentBuffer;

    // Connect source directly to destination (sound card) to preserve L/R mapping
    // L = Channel 0, R = Channel 1
    this.source.connect(ctx.destination);

    // Set callback for end of playback
    this.source.onended = () => {
      // Only trigger ended state if we reached the end naturally (not stopped or paused)
      if (this.status === "playing") {
        this.stopTimeTracker();
        this.pausedAtSeconds = 0;
        this.setStatus("ended");
      }
    };

    const offset = this.pausedAtSeconds;
    this.source.start(0, offset);
    this.startedAtAudioContextTime = ctx.currentTime - offset;
    this.setStatus("playing");
    
    this.startTimeTracker();
  }

  /**
   * Pauses playback
   */
  public pause() {
    if (this.status !== "playing" || !this.source) return;

    const ctx = this.getContext();
    this.stopTimeTracker();
    
    // Calculate exact pause position
    const elapsed = ctx.currentTime - this.startedAtAudioContextTime;
    this.pausedAtSeconds = Math.min(elapsed, this.duration);
    
    this.stopSourceNode();
    this.setStatus("paused");
  }

  /**
   * Stops playback completely
   */
  public stop() {
    this.stopTimeTracker();
    this.stopSourceNode();
    this.pausedAtSeconds = 0;
    
    if (this.currentBuffer) {
      this.setStatus("stopped");
      if (this.listeners.onTimeUpdate) {
        this.listeners.onTimeUpdate(0);
      }
    } else {
      this.setStatus("idle");
    }
  }

  /**
   * Jumps to a specific time offset in seconds
   */
  public seek(seconds: number) {
    const wasPlaying = this.status === "playing";
    this.stopSourceNode();
    
    this.pausedAtSeconds = Math.max(0, Math.min(seconds, this.duration));
    
    if (this.listeners.onTimeUpdate) {
      this.listeners.onTimeUpdate(this.pausedAtSeconds);
    }

    if (wasPlaying) {
      this.play().catch((err) => {
        console.error("Error doing seek-play:", err);
      });
    } else if (this.currentBuffer) {
      this.setStatus("paused");
    }
  }

  /**
   * Internal helper to stop source node and avoid node leakage
   */
  private stopSourceNode() {
    if (this.source) {
      try {
        this.source.stop();
        this.source.disconnect();
      } catch (e) {
        // Source node might already be stopped
      }
      this.source = null;
    }
  }

  /**
   * Timers for tracking time updates
   */
  private startTimeTracker() {
    this.stopTimeTracker();
    
    const update = () => {
      if (this.status !== "playing" || !this.ctx) return;
      const elapsed = this.ctx.currentTime - this.startedAtAudioContextTime;
      const current = Math.min(elapsed, this.duration);
      if (this.listeners.onTimeUpdate) {
        this.listeners.onTimeUpdate(current);
      }
    };

    update();
    this.timeUpdateInterval = setInterval(update, 200);
  }

  private stopTimeTracker() {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }

  /**
   * Generates a 2-channel audio test buffer on-the-fly using Web Audio API oscillators.
   * L contains beeps, R contains silence (or vice versa).
   */
  public async generateLRTestBuffer(channel: "L" | "R" | "both"): Promise<AudioBuffer> {
    const ctx = this.getContext();
    const sampleRate = ctx.sampleRate;
    const duration = 2.0; // 2 seconds
    const buffer = ctx.createBuffer(2, sampleRate * duration, sampleRate);
    
    const leftChannel = buffer.getChannelData(0);
    const rightChannel = buffer.getChannelData(1);
    
    const frequency = 440; // A4 tone
    
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      // Pulse tone every 0.4 seconds
      const isPulse = (t % 0.6) < 0.3;
      const val = isPulse ? Math.sin(2 * Math.PI * frequency * t) * 0.5 : 0;
      
      if (channel === "L" || channel === "both") {
        leftChannel[i] = val;
      }
      if (channel === "R" || channel === "both") {
        rightChannel[i] = val;
      }
    }
    
    return buffer;
  }

  /**
   * Gets the current playback status
   */
  public getStatus(): AudioEngineState {
    return this.status;
  }

  /**
   * Gets the current paused position
   */
  public getCurrentTime(): number {
    if (this.status === "playing" && this.ctx) {
      const elapsed = this.ctx.currentTime - this.startedAtAudioContextTime;
      return Math.min(elapsed, this.duration);
    }
    return this.pausedAtSeconds;
  }

  /**
   * Gets duration of loaded track
   */
  public getDuration(): number {
    return this.duration;
  }
}
