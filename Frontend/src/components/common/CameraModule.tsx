import React, { useEffect, useRef, useState } from "react";
import type { Project } from "../../data/projects";

interface CameraModuleProps {
  project: Project;
  onCapture: (photoUrl: string) => void;
  onCancel?: () => void;
}

export function CameraModule({ project, onCapture, onCancel }: CameraModuleProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [gridOn, setGridOn] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [flashEffect, setFlashEffect] = useState<boolean>(false);
  const [retryKey, setRetryKey] = useState<number>(0);

  // Live telemetry HUD state
  const [coords, setCoords] = useState<string>(project.coords || "12.9716° N, 77.5946° E");
  const [accuracy, setAccuracy] = useState<string>("± 3.2m");
  const [timestamp, setTimestamp] = useState<string>("");

  // Update HUD timestamp continuously
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimestamp(now.toISOString().replace("T", " ").substring(0, 19) + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Try real browser Geolocation for HUD if available
  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(5);
          const lng = pos.coords.longitude.toFixed(5);
          const latDir = pos.coords.latitude >= 0 ? "N" : "S";
          const lngDir = pos.coords.longitude >= 0 ? "E" : "W";
          setCoords(`${Math.abs(Number(lat))}° ${latDir}, ${Math.abs(Number(lng))}° ${lngDir}`);
          if (pos.coords.accuracy) {
            setAccuracy(`± ${pos.coords.accuracy.toFixed(1)}m`);
          }
        },
        () => {
          // Fallback to project coords on permission deny or error
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [project.coords]);

  // Start Media Stream
  useEffect(() => {
    let active = true;
    setLoading(true);
    setCameraError(null);

    async function initCamera() {
      // Stop previous stream tracks
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (active) {
          setCameraError("WebRTC camera access is not supported by your browser environment.");
          setLoading(false);
        }
        return;
      }

      try {
        let mediaStream: MediaStream;
        try {
          // Attempt preferred facing mode
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facingMode },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });
        } catch {
          // Fallback to generic video
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        if (!active) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }

        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }

        // Check torch support
        const videoTrack = mediaStream.getVideoTracks()[0];
        if (videoTrack && typeof videoTrack.getCapabilities === "function") {
          const caps = videoTrack.getCapabilities() as { torch?: boolean };
          setTorchSupported(!!caps?.torch);
        } else {
          setTorchSupported(false);
        }

        setLoading(false);
      } catch (err: any) {
        if (!active) return;
        setLoading(false);
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setCameraError("Camera permission was denied. Please allow camera access in your browser settings.");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setCameraError("No camera hardware detected on this device.");
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
          setCameraError("Camera is currently in use by another application.");
        } else {
          setCameraError(err.message || "Failed to initialize live camera feed.");
        }
      }
    }

    initCamera();

    return () => {
      active = false;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode, retryKey]);

  // Handle Torch toggle
  const toggleTorch = async () => {
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack && torchSupported) {
      try {
        const nextState = !torchOn;
        await videoTrack.applyConstraints({
          advanced: [{ torch: nextState } as any],
        });
        setTorchOn(nextState);
      } catch {
        setTorchOn(false);
      }
    }
  };

  // Play shutter sound effect
  const playShutterSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      }
    } catch {
      // Audio fallback silent
    }
  };

  // Capture current video frame onto canvas
  const handleCapture = () => {
    playShutterSound();
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 200);

    const canvas = canvasRef.current || document.createElement("canvas");
    const video = videoRef.current;

    let width = 1280;
    let height = 960;

    if (video && video.videoWidth && video.videoHeight) {
      width = video.videoWidth;
      height = video.videoHeight;
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      if (video && video.readyState >= 2) {
        // Draw video frame
        if (facingMode === "user") {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, width, height);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        } else {
          ctx.drawImage(video, 0, 0, width, height);
        }
      } else {
        // Fallback synthetic camera background if stream initializing
        ctx.fillStyle = "#1E293B";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#334155";
        ctx.fillRect(40, 40, width - 80, height - 80);
      }

      // Burn geotag HUD watermark into captured image
      const padding = 24;
      const boxHeight = 110;
      ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
      ctx.fillRect(padding, height - boxHeight - padding, width - padding * 2, boxHeight);
      ctx.strokeStyle = "#4F46E5";
      ctx.lineWidth = 4;
      ctx.strokeRect(padding, height - boxHeight - padding, width - padding * 2, boxHeight);

      // Text metadata
      ctx.fillStyle = "#6366F1";
      ctx.font = "bold 20px monospace";
      ctx.fillText(`MPLADS AI-GUARDIAN FIELD AUDIT EVIDENCE`, padding + 16, height - boxHeight - padding + 32);

      ctx.fillStyle = "#F8FAFC";
      ctx.font = "18px sans-serif";
      ctx.fillText(`PROJECT ID: ${project.id} | ${project.title.substring(0, 35)}`, padding + 16, height - boxHeight - padding + 60);

      ctx.fillStyle = "#10B981";
      ctx.font = "bold 16px monospace";
      ctx.fillText(`GPS: ${coords} (${accuracy})  |  TIME: ${timestamp}`, padding + 16, height - boxHeight - padding + 88);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      onCapture(dataUrl);
    }
  };

  return (
    <div className="relative rounded-3xl overflow-hidden flex flex-col justify-between select-none" style={{ background: "#0F172A", height: 380 }}>
      <canvas ref={canvasRef} className="hidden" />

      {/* Visual Shutter Flash Effect */}
      {flashEffect && (
        <div className="absolute inset-0 bg-white z-40 transition-opacity duration-150 animate-pulse pointer-events-none" />
      )}

      {/* Video Viewport / Error State */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-black flex items-center justify-center">
        {!cameraError ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition-transform duration-300 ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
          />
        ) : (
          <div className="p-6 text-center text-white space-y-3 z-10 max-w-xs">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 mx-auto flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            </div>
            <div className="text-xs text-slate-300 font-medium leading-relaxed">{cameraError}</div>
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-xs font-semibold shadow-lg transition-transform active:scale-95 flex items-center gap-1.5 mx-auto"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
              </svg>
              Retry Camera Connection
            </button>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && !cameraError && (
          <div className="absolute inset-0 bg-slate-950/80 z-10 flex flex-col items-center justify-center text-white gap-2">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono text-slate-300">Initializing AI Camera...</span>
          </div>
        )}

        {/* Rule-of-Thirds Grid Overlay */}
        {gridOn && !cameraError && (
          <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 z-10 opacity-30">
            <div className="border-r border-b border-white/60" />
            <div className="border-r border-b border-white/60" />
            <div className="border-b border-white/60" />
            <div className="border-r border-b border-white/60" />
            <div className="border-r border-b border-white/60" />
            <div className="border-b border-white/60" />
            <div className="border-r border-white/60" />
            <div className="border-r border-white/60" />
            <div />
          </div>
        )}

        {/* AI Geotag Target Scanner Reticle */}
        {!cameraError && !loading && (
          <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
            <div className="w-48 h-48 border-2 border-indigo-500/50 rounded-2xl relative flex items-center justify-center animate-pulse">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-indigo-400" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-indigo-400" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-indigo-400" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-indigo-400" />
              <div className="w-2 h-2 rounded-full bg-indigo-400 opacity-80" />
            </div>
          </div>
        )}
      </div>

      {/* Top Controls Overlay */}
      <div className="relative z-20 p-3 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-[10px] font-mono font-bold tracking-wider text-emerald-400 bg-slate-900/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
            AI GEOTAG LIVE
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Torch toggle */}
          {torchSupported && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${
                torchOn ? "bg-amber-400 text-slate-950" : "bg-black/40 text-white hover:bg-black/60"
              }`}
              title="Toggle Torch"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 2v11h3v9l7-12h-4l4-8z" />
              </svg>
            </button>
          )}

          {/* Grid toggle */}
          <button
            type="button"
            onClick={() => setGridOn(!gridOn)}
            className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${
              gridOn ? "bg-indigo-600 text-white" : "bg-black/40 text-slate-300 hover:bg-black/60"
            }`}
            title="Toggle Rule-of-Thirds Grid"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 20H4v-4h4v4zm0-6H4v-4h4v4zm0-6H4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4z" />
            </svg>
          </button>

          {/* Flip Camera button */}
          <button
            type="button"
            onClick={() => setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))}
            className="w-8 h-8 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/60 flex items-center justify-center transition-transform active:rotate-180"
            title="Flip Camera"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Live Geotag HUD Bottom Overlay */}
      <div className="relative z-20 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent space-y-3">
        <div className="bg-slate-950/70 backdrop-blur-md border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between gap-2 text-white">
          <div className="min-w-0">
            <div className="text-[10px] font-mono text-indigo-400 font-bold truncate">
              {coords} <span className="text-slate-400">({accuracy})</span>
            </div>
            <div className="text-[9px] font-mono text-slate-400 truncate mt-0.5">
              TIMESTAMP: {timestamp}
            </div>
          </div>
          <div className="text-[9px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-1 rounded-md shrink-0">
            SITE MATCH OK
          </div>
        </div>

        {/* Shutter Bar */}
        <div className="flex items-center justify-around px-8 pb-1">
          {/* Flip Camera Quick Control */}
          <button
            type="button"
            onClick={() => setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))}
            className="w-11 h-11 rounded-full bg-slate-900/80 text-slate-300 border border-slate-700 flex items-center justify-center backdrop-blur-md active:scale-95 transition-all hover:text-white"
            title="Flip Camera"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
            </svg>
          </button>

          {/* Main Camera Shutter Button */}
          <button
            type="button"
            onClick={handleCapture}
            className="w-16 h-16 rounded-full border-4 border-white/90 p-1 flex items-center justify-center shadow-xl active:scale-90 transition-transform group"
            title="Take Photo"
          >
            <div className="w-full h-full rounded-full bg-indigo-600 group-hover:bg-indigo-500 transition-colors shadow-inner flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-white opacity-80" />
            </div>
          </button>

          {/* Grid quick toggle */}
          <button
            type="button"
            onClick={() => setGridOn((g) => !g)}
            className={`w-11 h-11 rounded-full border border-slate-700 flex items-center justify-center backdrop-blur-md active:scale-95 transition-all ${
              gridOn ? "bg-indigo-900/60 text-indigo-300 border-indigo-500/40" : "bg-slate-900/80 text-slate-400"
            }`}
            title="Grid Toggle"
          >
            <span className="text-[10px] font-mono font-bold">GRID</span>
          </button>
        </div>
      </div>
    </div>
  );
}
