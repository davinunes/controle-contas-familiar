"use client";
import { useEffect, useRef, useState, useCallback } from "react";

interface QRScannerProps {
  onDetect: (url: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onDetect, onClose }: QRScannerProps) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const rafRef     = useRef<number>(0);
  const [error, setError]   = useState("");
  const [scanning, setScanning] = useState(true);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const scan = useCallback(async () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scan);
      return;
    }

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);

    let detected: string | null = null;

    // Tenta BarcodeDetector nativa
    if ("BarcodeDetector" in window) {
      try {
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        const barcodes = await detector.detect(canvas);
        if (barcodes.length > 0) detected = barcodes[0].rawValue;
      } catch { /* fallback abaixo */ }
    }

    // Fallback: jsQR
    if (!detected) {
      try {
        const { default: jsQR } = await import("jsqr");
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) detected = code.data;
      } catch { /* ignora */ }
    }

    if (detected) {
      stopCamera();
      setScanning(false);
      onDetect(detected);
      return;
    }

    rafRef.current = requestAnimationFrame(scan);
  }, [stopCamera, onDetect]);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } } })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          rafRef.current = requestAnimationFrame(scan);
        }
      })
      .catch(err => {
        setError("Não foi possível acessar a câmera: " + err.message);
      });

    return stopCamera;
  }, [scan, stopCamera]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "#000",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px",
        background: "rgba(0,0,0,0.8)",
      }}>
        <span style={{ color: "#fff", fontWeight: 600 }}>📷 Escanear QR Code da NF</span>
        <button
          onClick={() => { stopCamera(); onClose(); }}
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "none", color: "#fff",
            width: 36, height: 36, borderRadius: "50%",
            fontSize: "1.1rem", cursor: "pointer",
          }}
        >✕</button>
      </div>

      {/* Camera */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {error ? (
          <div style={{
            color: "#fff", textAlign: "center", padding: "40px 24px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
          }}>
            <span style={{ fontSize: "3rem" }}>📷</span>
            <p>{error}</p>
            <button className="btn btn-secondary" onClick={() => { stopCamera(); onClose(); }}>
              Fechar
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              playsInline
              muted
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {/* Viewfinder */}
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ position: "relative", width: 240, height: 240 }}>
                {/* Corners */}
                {[
                  { top: 0, left: 0, borderTop: "3px solid #6c63ff", borderLeft: "3px solid #6c63ff" },
                  { top: 0, right: 0, borderTop: "3px solid #6c63ff", borderRight: "3px solid #6c63ff" },
                  { bottom: 0, left: 0, borderBottom: "3px solid #6c63ff", borderLeft: "3px solid #6c63ff" },
                  { bottom: 0, right: 0, borderBottom: "3px solid #6c63ff", borderRight: "3px solid #6c63ff" },
                ].map((style, i) => (
                  <div key={i} style={{ position: "absolute", width: 28, height: 28, ...style }} />
                ))}
                {/* Scan line */}
                {scanning && (
                  <div style={{
                    position: "absolute", top: "50%", left: 8, right: 8,
                    height: 2, background: "var(--accent)",
                    boxShadow: "0 0 8px var(--accent)",
                    animation: "scanLine 1.8s ease-in-out infinite",
                  }} />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{
        padding: "16px", textAlign: "center",
        background: "rgba(0,0,0,0.8)", color: "rgba(255,255,255,0.6)",
        fontSize: "0.85rem",
      }}>
        Aponte para o QR Code da nota fiscal
      </div>

      <style>{`
        @keyframes scanLine {
          0%, 100% { transform: translateY(-80px); }
          50%       { transform: translateY(80px);  }
        }
      `}</style>
    </div>
  );
}
