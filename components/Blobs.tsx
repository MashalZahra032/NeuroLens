export default function Blobs() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{
        position: "absolute", top: "-20%", left: "-10%",
        width: 600, height: 600,
        background: "radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)",
        borderRadius: "50%", animation: "float 8s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", top: "30%", right: "-15%",
        width: 500, height: 500,
        background: "radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)",
        borderRadius: "50%", animation: "float 10s ease-in-out infinite reverse",
      }} />
      <div style={{
        position: "absolute", bottom: "-10%", left: "30%",
        width: 400, height: 400,
        background: "radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 70%)",
        borderRadius: "50%", animation: "float 12s ease-in-out infinite",
      }} />
    </div>
  );
}
