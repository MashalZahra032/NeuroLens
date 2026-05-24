"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────
type Mode = "classify" | "detect" | "segment" | "all";

interface BBox { x1: number; y1: number; x2: number; y2: number; }
interface Detection {
  class_id: number;
  class_name: string;
  confidence: number;
  bbox?: BBox;
  mask_polygon?: number[][];
}
interface ClassifyResult {
  class_id: number; class_name: string; confidence: number;
  all_scores: Record<string, number>;
  region: string; region_confidence: number; latency_ms: number;
}
interface DetectResult {
  count: number; detections: Detection[];
  region: string; region_confidence: number; latency_ms: number;
}
interface AnalyzeResult {
  classification: ClassifyResult;
  detection: DetectResult;
  segmentation: DetectResult;
  region: string; region_confidence: number; latency_ms: number;
}
type ApiResult = ClassifyResult | DetectResult | AnalyzeResult;

// ── Colours ───────────────────────────────────────────────────────────────────
const CLASS_COLORS: Record<string, string> = {
  modest_male:          "#34d399",
  immodest_male:        "#f87171",
  modest_female_niqab:  "#60a5fa",
  modest_female_hijab:  "#818cf8",
  immodest_female:      "#fb923c",
};

const REGION_META: Record<string, { emoji: string; color: string; label: string }> = {
  "Arab":              { emoji: "🕌", color: "#fbbf24", label: "Arab Region" },
  "South Asian":       { emoji: "🌿", color: "#34d399", label: "South Asian" },
  "Mixed / Uncertain": { emoji: "🔮", color: "#a78bfa", label: "Mixed / Uncertain" },
  "Unknown":           { emoji: "❓", color: "#64748b", label: "Unknown" },
};

const MODES: { id: Mode; label: string; api: string }[] = [
  { id: "classify", label: "Classify",  api: "/api/classify" },
  { id: "detect",   label: "Detect",    api: "/api/detect"   },
  { id: "segment",  label: "Segment",   api: "/api/segment"  },
  { id: "all",      label: "All Three", api: "/api/analyze"  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function RegionBadge({ region, confidence }: { region: string; confidence: number }) {
  const m = REGION_META[region] ?? REGION_META["Unknown"];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        background: `${m.color}15`,
        border: `1px solid ${m.color}55`,
        borderRadius: 12, padding: "10px 16px", marginBottom: 18,
      }}
    >
      <span style={{ fontSize: 22 }}>{m.emoji}</span>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Detected Region
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: m.color }}>
          {m.label}
          {confidence > 0 && (
            <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-3)", marginLeft: 8 }}>
              {(confidence * 100).toFixed(0)}% signal
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ConfBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "var(--text-2)", fontFamily: "'JetBrains Mono',monospace" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "'JetBrains Mono',monospace" }}>
          {(value * 100).toFixed(1)}%
        </span>
      </div>
      <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 3, height: 5, overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
          style={{ height: "100%", borderRadius: 3, background: `linear-gradient(90deg, var(--purple), ${color})` }}
        />
      </div>
    </div>
  );
}

function DetCard({ det, idx }: { det: Detection; idx: number }) {
  const color = CLASS_COLORS[det.class_name] || "#a78bfa";
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.07 }}
      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${color}33`,
               borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
          background: `${color}22`, color, fontFamily: "'JetBrains Mono',monospace" }}>
          {det.class_name}
        </span>
        <span style={{ fontSize: 16, fontWeight: 800, color }}>{(det.confidence * 100).toFixed(1)}%</span>
      </div>
      {det.bbox && (
        <div style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "'JetBrains Mono',monospace", marginTop: 5 }}>
          [{det.bbox.x1}, {det.bbox.y1}] → [{det.bbox.x2}, {det.bbox.y2}]
          {det.mask_polygon && <span style={{ marginLeft: 8 }}>· {det.mask_polygon.length}pt mask</span>}
        </div>
      )}
    </motion.div>
  );
}

// Canvas overlay for detect/segment results
function AnnotatedImage({ src, detections, showMasks }: { src: string; detections: Detection[]; showMasks: boolean }) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !src || !detections.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      const cw = containerRef.current?.clientWidth ?? img.naturalWidth;
      const sc = cw / img.naturalWidth;
      const ch = img.naturalHeight * sc;
      canvas.width = cw; canvas.height = ch;
      ctx.drawImage(img, 0, 0, cw, ch);

      detections.forEach(det => {
        const color = CLASS_COLORS[det.class_name] || "#a78bfa";
        // Mask polygon
        if (showMasks && det.mask_polygon && det.mask_polygon.length > 2) {
          ctx.beginPath();
          det.mask_polygon.forEach(([px, py], i) =>
            i === 0 ? ctx.moveTo(px*sc, py*sc) : ctx.lineTo(px*sc, py*sc)
          );
          ctx.closePath();
          ctx.fillStyle = color + "40"; ctx.fill();
          ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
        }
        // Bounding box
        if (det.bbox) {
          const { x1, y1, x2, y2 } = det.bbox;
          const bx = x1*sc, by = y1*sc, bw = (x2-x1)*sc, bh = (y2-y1)*sc;
          ctx.strokeStyle = color; ctx.lineWidth = 2;
          ctx.strokeRect(bx, by, bw, bh);
          // Corner accents
          const cl = Math.min(bw, bh) * 0.18;
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          [[[bx+cl,by],[bx,by],[bx,by+cl]],[[bx+bw-cl,by],[bx+bw,by],[bx+bw,by+cl]],
           [[bx,by+bh-cl],[bx,by+bh],[bx+cl,by+bh]],[[bx+bw-cl,by+bh],[bx+bw,by+bh],[bx+bw,by+bh-cl]]]
          .forEach(pts => { ctx.moveTo(pts[0][0],pts[0][1]); ctx.lineTo(pts[1][0],pts[1][1]); ctx.lineTo(pts[2][0],pts[2][1]); });
          ctx.stroke();
          // Label
          const lbl = `${det.class_name}  ${(det.confidence*100).toFixed(1)}%`;
          ctx.font = "bold 11px 'JetBrains Mono',monospace";
          const tw = ctx.measureText(lbl).width;
          const lh = 18, lx = bx, ly = by > lh+4 ? by-lh-4 : by+4;
          ctx.fillStyle = color;
          ctx.beginPath();
ctx.roundRect(lx, ly, tw+14, lh, 3); ctx.fill();
          ctx.fillStyle = "#000";
          ctx.fillText(lbl, lx+7, ly+13);
        }
      });
    };
    img.src = src;
  }, [src, detections, showMasks]);

  return (
    <div ref={containerRef} style={{ position:"relative", width:"100%", borderRadius:10, overflow:"hidden" }}>
      <img src={src} alt="input" style={{ width:"100%", display:"block", borderRadius:10 }} />
      <canvas ref={canvasRef} style={{ position:"absolute",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none" }} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function VisionStudio() {
  const [mode,    setMode]    = useState<Mode>("detect");
  const [image,   setImage]   = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging,setDragging]= useState(false);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<ApiResult | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [conf,    setConf]    = useState(0.4);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setImage(file); setResult(null); setError(null);
    const r = new FileReader();
    r.onload = e => setPreview(e.target?.result as string);
    r.readAsDataURL(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith("image/")) handleFile(f);
  }, []);

  const analyse = async () => {
    if (!image) return;
    setLoading(true); setResult(null); setError(null);
    const fd = new FormData();
    fd.append("image", image);
    const modeInfo = MODES.find(m => m.id === mode)!;
    const url = mode === "detect" || mode === "segment"
      ? `${modeInfo.api}?conf=${conf}`
      : modeInfo.api;
    try {
      const res  = await fetch(url, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) setError((data as { error?: string }).error || `HTTP ${res.status}`);
      else setResult(data as ApiResult);
    } catch (e) {
      setError(`Network error: ${e instanceof Error ? e.message : e}`);
    } finally { setLoading(false); }
  };

  // ── Derive display data ──────────────────────────────────────────────────
  const region     = result ? (result as { region?: string }).region     ?? "Unknown" : null;
  const regionConf = result ? (result as { region_confidence?: number }).region_confidence ?? 0 : 0;

  // For canvas overlay — collect all detections across modes
  const overlayDets: Detection[] = (() => {
    if (!result) return [];
    if (mode === "detect")  return (result as DetectResult).detections ?? [];
    if (mode === "segment") return (result as DetectResult).detections ?? [];
    if (mode === "all") {
      const ar = result as AnalyzeResult;
      return [...(ar.detection?.detections ?? []), ...(ar.segmentation?.detections ?? [])];
    }
    return [];
  })();

  const showMasks = mode === "segment" || mode === "all";

  const modeIdx   = MODES.findIndex(m => m.id === mode);
  const pillWidth = 100 / MODES.length;

  // ── Result panels ────────────────────────────────────────────────────────
  const renderClassify = (cls: ClassifyResult) => (
    <div>
      <div style={{ textAlign:"center", marginBottom:18 }}>
        <div style={{ display:"inline-block", padding:"5px 16px", borderRadius:999,
          background:`${CLASS_COLORS[cls.class_name]??'#a78bfa'}20`,
          border:`1px solid ${CLASS_COLORS[cls.class_name]??'#a78bfa'}`,
          color: CLASS_COLORS[cls.class_name]??'#a78bfa',
          fontSize:13, fontWeight:700, marginBottom:8, fontFamily:"'JetBrains Mono',monospace" }}>
          {cls.class_name}
        </div>
        <div style={{ fontSize:38, fontWeight:800, color: CLASS_COLORS[cls.class_name]??'#a78bfa' }}>
          {(cls.confidence*100).toFixed(1)}%
        </div>
      </div>
      {Object.entries(cls.all_scores).sort(([,a],[,b])=>b-a).map(([k,v])=>(
        <ConfBar key={k} label={k} value={v} color={CLASS_COLORS[k]||"#a78bfa"} />
      ))}
    </div>
  );

  const renderDetSeg = (d: DetectResult, label: string) => (
    <div>
      <div style={{ fontSize:11, color:"var(--text-3)", fontWeight:600,
        letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>
        {label} · {d.count} result{d.count!==1?"s":""}
      </div>
      {d.count===0
        ? <p style={{color:"var(--text-3)",fontSize:13,textAlign:"center",padding:"1rem 0"}}>No detections above {conf} threshold</p>
        : d.detections.map((det,i)=><DetCard key={i} det={det} idx={i}/>)}
    </div>
  );

  const renderResult = () => {
    if (!result) return null;
    if (mode === "classify") return renderClassify(result as ClassifyResult);
    if (mode === "detect")   return renderDetSeg(result as DetectResult, "Detection");
    if (mode === "segment")  return renderDetSeg(result as DetectResult, "Segmentation");
    if (mode === "all") {
      const ar = result as AnalyzeResult;
      return (
        <div>
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:11, color:"var(--text-3)", fontWeight:600,
              letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>Classification</div>
            {renderClassify(ar.classification)}
          </div>
          <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:16, marginBottom:16 }}>
            {renderDetSeg(ar.detection, "Detection")}
          </div>
          <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:16 }}>
            {renderDetSeg(ar.segmentation, "Segmentation")}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <section id="studio" style={{ maxWidth:960, margin:"0 auto", padding:"4rem 1.5rem" }}>
      <motion.div initial={{ opacity:0, y:30 }} whileInView={{ opacity:1, y:0 }}
        viewport={{ once:true }} transition={{ duration:0.7 }}
        style={{ textAlign:"center", marginBottom:"3rem" }}>
        <h2 style={{ fontSize:"clamp(2rem,5vw,3rem)", fontWeight:800, marginBottom:12 }}>
          Vision <span className="grad-text">Studio</span>
        </h2>
        <p style={{ color:"var(--text-3)", fontSize:17 }}>
          Drop an image · pick a mode · watch NeuroLens work
        </p>
      </motion.div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, alignItems:"start" }}>

        {/* ── Left: upload panel ── */}
        <motion.div initial={{ opacity:0, x:-30 }} whileInView={{ opacity:1, x:0 }}
          viewport={{ once:true }} transition={{ duration:0.6 }}
          className="glass" style={{ borderRadius:20, padding:24 }}>

          {/* Mode pill selector */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, color:"var(--text-3)", fontWeight:600,
              letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>Analysis mode</div>
            <div className="pill-selector">
              <div className="pill-slider"
                style={{ left:`calc(${modeIdx*pillWidth}% + 4px)`, width:`calc(${pillWidth}% - 8px)` }} />
              {MODES.map(m=>(
                <button key={m.id} className={`pill-option ${mode===m.id?"active":""}`}
                  onClick={()=>{ setMode(m.id); setResult(null); setError(null); }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Confidence (only for detect/segment/all) */}
          {mode !== "classify" && (
            <div style={{ marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <span style={{ fontSize:11, color:"var(--text-3)", fontWeight:600,
                  letterSpacing:"0.1em", textTransform:"uppercase" }}>Confidence threshold</span>
                <span style={{ fontSize:12, fontFamily:"'JetBrains Mono',monospace",
                  color:"var(--purple-light)" }}>{conf.toFixed(2)}</span>
              </div>
              <input type="range" min={0.1} max={0.9} step={0.05} value={conf}
                onChange={e=>setConf(parseFloat(e.target.value))}
                style={{ width:"100%", accentColor:"var(--purple)" }} />
            </div>
          )}

          {/* Drop zone */}
          <div className={`drop-zone ${dragging?"dragging":""}`}
            style={{ borderRadius:16, padding:"1.5rem", textAlign:"center", cursor:"pointer",
              marginBottom:16, minHeight:160, display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"center" }}
            onClick={()=>fileRef.current?.click()}
            onDragOver={e=>{ e.preventDefault(); setDragging(true); }}
            onDragLeave={()=>setDragging(false)}
            onDrop={onDrop}>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }}
              onChange={e=>{ if(e.target.files?.[0]) handleFile(e.target.files[0]); }} />
            {preview ? (
              <img src={preview} alt="preview"
                style={{ maxWidth:"100%", maxHeight:160, borderRadius:10, objectFit:"contain" }} />
            ) : (
              <>
                <div style={{ fontSize:36, marginBottom:10, opacity:0.4 }}>⬆</div>
                <div style={{ color:"var(--text-3)", fontSize:14 }}>Drop image or click to browse</div>
                <div style={{ color:"var(--text-3)", fontSize:11, marginTop:4, opacity:0.6 }}>PNG · JPG · WEBP up to 32MB</div>
              </>
            )}
          </div>

          {/* Annotated overlay — show after result for detect/segment/all */}
          {result && preview && overlayDets.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, color:"var(--text-3)", fontWeight:600,
                letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>
                {showMasks ? "Segmentation Overlay" : "Detection Overlay"}
              </div>
              <AnnotatedImage src={preview} detections={overlayDets} showMasks={showMasks} />
            </div>
          )}

          <button className="glow-btn" disabled={!image||loading} onClick={analyse}
            style={{ width:"100%", padding:"13px", borderRadius:12, border:"none",
              color:"white", fontSize:14, fontWeight:700,
              fontFamily:"'Syne',sans-serif", cursor:"pointer", letterSpacing:"0.05em" }}>
            {loading ? "Analysing…" : `Run ${MODES.find(m=>m.id===mode)?.label}`}
          </button>
        </motion.div>

        {/* ── Right: results panel ── */}
        <motion.div initial={{ opacity:0, x:30 }} whileInView={{ opacity:1, x:0 }}
          viewport={{ once:true }} transition={{ duration:0.6, delay:0.1 }}
          className="glass" style={{ borderRadius:20, padding:24, minHeight:420 }}>

          <div style={{ fontSize:11, color:"var(--text-3)", fontWeight:600,
            letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:16 }}>Results</div>

          <AnimatePresence mode="wait">
            {loading && (
              <motion.div key="loading" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                style={{ display:"flex", flexDirection:"column", alignItems:"center",
                  justifyContent:"center", padding:"4rem 0" }}>
                <div style={{ width:44, height:44, borderRadius:"50%",
                  border:"3px solid rgba(124,58,237,0.15)",
                  borderTopColor:"var(--purple)",
                  animation:"spin-ring 0.9s linear infinite", marginBottom:14 }} />
                <div style={{ color:"var(--text-3)", fontSize:13 }}>Processing…</div>
              </motion.div>
            )}
            {error && !loading && (
              <motion.div key="error" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                style={{ background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.3)",
                  borderRadius:12, padding:16, color:"#f87171", fontSize:13 }}>
                ⚠ {error}
              </motion.div>
            )}
            {result && !loading && !error && (
              <motion.div key="result" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
                {/* Region badge */}
                {region && <RegionBadge region={region} confidence={regionConf} />}
                {renderResult()}
                <div style={{ marginTop:16, paddingTop:12, borderTop:"1px solid rgba(255,255,255,0.06)",
                  fontSize:11, color:"var(--text-3)", fontFamily:"'JetBrains Mono',monospace" }}>
                  latency: {(result as { latency_ms?: number }).latency_ms ?? "—"}ms · mode: {mode}
                </div>
              </motion.div>
            )}
            {!result && !loading && !error && (
              <motion.div key="empty" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                style={{ display:"flex", flexDirection:"column", alignItems:"center",
                  justifyContent:"center", padding:"4rem 0", color:"var(--text-3)" }}>
                <div style={{ fontSize:44, marginBottom:12, opacity:0.25 }}>◎</div>
                <div style={{ fontSize:13 }}>Results will appear here</div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
