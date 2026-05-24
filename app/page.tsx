"use client";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import VisionStudio from "@/components/VisionStudio";
import Blobs from "@/components/Blobs";

const ParticleNetwork = dynamic(() => import("@/components/ParticleNetwork"), { ssr: false });

const FEATURES = [
  { icon: "◈", title: "Classification", desc: "EfficientNet-powered single-person modesty classification across 5 categories with confidence scores.", color: "#a78bfa" },
  { icon: "⬡", title: "Detection", desc: "YOLOv8 multi-person detection with bounding boxes. Handles crowds, variable lighting, occlusion.", color: "#60a5fa" },
  { icon: "◉", title: "Segmentation", desc: "Pixel-perfect mask polygons via YOLOv8-seg. Per-person outlines with class labels and confidence.", color: "#34d399" },
];

export default function Home() {
  return (
    <main style={{ position: "relative", minHeight: "100vh", background: "var(--bg)" }}>
      <Blobs />
      <ParticleNetwork />

      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "1rem 2rem",
        background: "rgba(10,14,39,0.8)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(124,58,237,0.15)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #7C3AED, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: "0 0 16px rgba(124,58,237,0.5)" }}>◉</div>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>Neuro<span className="grad-text">Lens</span></span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[["#features","Features"],["#studio","Studio"]].map(([href,label]) => (
            <a key={href} href={href} style={{ color: "var(--text-3)", fontSize: 14, textDecoration: "none", padding: "6px 14px", borderRadius: 8 }}>{label}</a>
          ))}
        </div>
      </nav>

      <section style={{ position: "relative", zIndex: 1, padding: "8rem 2rem 5rem", textAlign: "center", maxWidth: 860, margin: "0 auto" }}>
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 999, border: "1px solid rgba(167,139,250,0.4)", background: "rgba(124,58,237,0.1)", fontSize: 12, color: "#a78bfa", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "1.5rem" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa", display: "inline-block", boxShadow: "0 0 8px #a78bfa" }} />
          Production-Grade Vision API
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
          style={{ fontSize: "clamp(2.8rem,7vw,4.5rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: "1.5rem" }}>
          Computer vision<br /><span className="shimmer-text">at neural speed</span>
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }}
          style={{ fontSize: "clamp(1rem,2.5vw,1.15rem)", color: "var(--text-3)", lineHeight: 1.7, maxWidth: 580, margin: "0 auto 2.5rem" }}>
          EfficientNet classification · YOLOv8 detection · pixel-perfect segmentation. Flask API + Next.js frontend. Deploy anywhere.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}
          style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="#studio" className="glow-btn" style={{ padding: "14px 32px", borderRadius: 12, color: "white", fontSize: 15, fontWeight: 700, textDecoration: "none", letterSpacing: "0.03em", display: "inline-block" }}>
            Try Vision Studio →
          </a>
          <a href="#features" style={{ padding: "14px 32px", borderRadius: 12, color: "var(--text-2)", fontSize: 15, fontWeight: 600, textDecoration: "none", border: "1px solid var(--border-bright)", display: "inline-block" }}>
            View Features
          </a>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
          style={{ display: "flex", gap: 40, justifyContent: "center", marginTop: "4rem", flexWrap: "wrap" }}>
          {[["5","modesty classes"],["3","model endpoints"],["<50ms","GPU latency"]].map(([val,label]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, background: "linear-gradient(135deg,#a78bfa,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{val}</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", letterSpacing: "0.05em" }}>{label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      <section id="features" style={{ position: "relative", zIndex: 1, padding: "4rem 2rem", maxWidth: 1000, margin: "0 auto" }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: "center", marginBottom: "3rem" }}>
          <h2 style={{ fontSize: "clamp(1.8rem,4vw,2.5rem)", fontWeight: 800, marginBottom: 10 }}>Three models. <span className="grad-text">One API.</span></h2>
          <p style={{ color: "var(--text-3)", fontSize: 16 }}>Each endpoint serves a different computer vision task</p>
        </motion.div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 20 }}>
          {FEATURES.map((f,i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i*0.12, duration: 0.5 }}
              className="glass card-hover" style={{ borderRadius: 20, padding: "2rem", cursor: "default" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: `${f.color}18`, border: `1px solid ${f.color}44`, fontSize: 22, color: f.color, marginBottom: 16, boxShadow: `0 0 20px ${f.color}22` }}>{f.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: f.color }}>{f.title}</h3>
              <p style={{ color: "var(--text-3)", fontSize: 14, lineHeight: 1.7 }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <div style={{ position: "relative", zIndex: 1 }}><VisionStudio /></div>

      <section style={{ position: "relative", zIndex: 1, maxWidth: 800, margin: "0 auto", padding: "4rem 2rem" }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="glass-strong" style={{ borderRadius: 24, padding: "2.5rem" }}>
          <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: "1.5rem" }}>Quick <span className="grad-text">setup</span></h3>
          {[
            ["1","Clone & install","git clone <repo> && cd neurolens && npm install && pip install -r requirements.txt"],
            ["2","Add model files","cp *.pt models/   # modesty_classifier_best.pt, detector, segmentor"],
            ["3","Set env variable","echo 'FLASK_API_URL=http://localhost:5000' >> .env.local"],
            ["4","Run both servers","python app.py   &&   npm run dev"],
          ].map(([num,title,cmd]) => (
            <div key={num} style={{ display: "flex", gap: 16, marginBottom: 20, alignItems: "flex-start" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,var(--purple),var(--blue))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, marginTop: 2 }}>{num}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: "var(--text-2)" }}>{title}</div>
                <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: "8px 14px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#a78bfa", border: "1px solid rgba(124,58,237,0.2)" }}>{cmd}</div>
              </div>
            </div>
          ))}
        </motion.div>
      </section>

      <footer style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "2rem", borderTop: "1px solid rgba(124,58,237,0.1)", color: "var(--text-3)", fontSize: 13 }}>
        <span style={{ fontWeight: 700 }}>Neuro<span style={{ background: "linear-gradient(135deg,#a78bfa,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Lens</span></span> · Flask + Next.js · EfficientNet + YOLOv8
      </footer>
    </main>
  );
}
