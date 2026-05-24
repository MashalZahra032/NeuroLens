"""
NeuroLens Flask Backend — v2 (Fixed + Region Detection)
────────────────────────────────────────────────────────
Endpoints:
  GET  /health            → liveness check
  POST /api/classify      → EfficientNet classifier
  POST /api/detect        → YOLOv8 detector (bounding boxes)
  POST /api/segment       → YOLOv8 segmentor (pixel masks)
  POST /api/analyze       → all three combined

All endpoints return `region` and `region_confidence` fields.
"""

import io, os, time, logging, traceback
import torch
import torch.nn.functional as F
from torchvision import transforms
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024  # 32 MB

# ── Constants ─────────────────────────────────────────────────────────────────
CLASS_NAMES = [
    "modest_male",
    "immodest_male",
    "modest_female_niqab",
    "modest_female_hijab",
    "immodest_female",
]

MODELS_DIR      = os.environ.get("MODELS_DIR", "./models")
CLASSIFIER_PATH = os.path.join(MODELS_DIR, "modesty_classifier_best.pt")
DETECTOR_PATH   = os.path.join(MODELS_DIR, "modesty_detector_best.pt")
SEGMENTOR_PATH  = os.path.join(MODELS_DIR, "modesty_segmentor_best.pt")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
log.info(f"Device: {DEVICE}")

# ── Image preprocessing ────────────────────────────────────────────────────────
classifier_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

# ── Lazy model loader ──────────────────────────────────────────────────────────
_models = {}

def get_classifier():
    if "classifier" not in _models:
        log.info("Loading classifier...")
        m = torch.load(CLASSIFIER_PATH, map_location=DEVICE, weights_only=False)
        m.to(DEVICE); m.eval()
        _models["classifier"] = m
    return _models["classifier"]

def get_detector():
    if "detector" not in _models:
        log.info("Loading detector...")
        _models["detector"] = YOLO(DETECTOR_PATH)
    return _models["detector"]

def get_segmentor():
    if "segmentor" not in _models:
        log.info("Loading segmentor...")
        _models["segmentor"] = YOLO(SEGMENTOR_PATH)
    return _models["segmentor"]

# ── Region inference ───────────────────────────────────────────────────────────
# Based on ethnicity signals from dress codes:
#   Arab region   → niqab (face veil), abaya styles
#   South Asian   → hijab without niqab (common in Pakistan/Bangladesh/India)
#   modest_male   → ambiguous (thobe=Arab, shalwar=SouthAsian) → weighted split
#
# Adjust these weights to match YOUR training data's regional distribution.

REGION_WEIGHTS = {
    # class_name            Arab    South Asian
    "modest_female_niqab":  (0.90,  0.10),   # niqab strongly → Arab
    "modest_female_hijab":  (0.45,  0.55),   # hijab common both; slight S.Asian lean
    "modest_male":          (0.50,  0.50),   # ambiguous without more context
    "immodest_male":        (0.50,  0.50),   # no signal
    "immodest_female":      (0.50,  0.50),   # no signal
}

def infer_region(detections: list) -> dict:
    """
    Vote across all detections to determine most likely region.
    Returns {"region": str, "region_confidence": float}
    """
    arab_score  = 0.0
    sa_score    = 0.0

    for det in detections:
        cls  = det.get("class_name", "")
        conf = det.get("confidence", 0.5)
        w    = REGION_WEIGHTS.get(cls, (0.5, 0.5))
        arab_score += conf * w[0]
        sa_score   += conf * w[1]

    total = arab_score + sa_score
    if total == 0:
        return {"region": "Unknown", "region_confidence": 0.0}

    diff = abs(arab_score - sa_score) / total
    if diff < 0.08:   # within 8% → call it mixed
        return {"region": "Mixed / Uncertain", "region_confidence": round(diff, 3)}

    if arab_score > sa_score:
        return {"region": "Arab", "region_confidence": round(arab_score / total, 3)}
    else:
        return {"region": "South Asian", "region_confidence": round(sa_score / total, 3)}

# ── Helpers ───────────────────────────────────────────────────────────────────
def load_image() -> Image.Image:
    if "image" in request.files:
        return Image.open(request.files["image"].stream).convert("RGB")
    if request.data:
        return Image.open(io.BytesIO(request.data)).convert("RGB")
    raise ValueError("No image provided. Send multipart field 'image' or raw binary body.")

def run_classify(img: Image.Image) -> dict:
    model  = get_classifier()
    tensor = classifier_transform(img).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        probs = F.softmax(model(tensor), dim=1)[0]
        conf, pred = torch.max(probs, 0)
    cls_name   = CLASS_NAMES[pred.item()]
    all_scores = {CLASS_NAMES[i]: round(float(probs[i]), 4) for i in range(len(CLASS_NAMES))}
    ri = infer_region([{"class_name": cls_name, "confidence": float(conf)}])
    return {
        "class_id":   int(pred.item()),
        "class_name": cls_name,
        "confidence": round(float(conf), 4),
        "all_scores": all_scores,
        **ri,
    }

def run_detect(img: Image.Image, conf_thresh: float = 0.4) -> dict:
    import numpy as np
    model  = get_detector()
    img_np = np.array(img)[:, :, ::-1].copy()
    r      = model(img_np, conf=conf_thresh, verbose=False)[0]
    dets   = []
    if r.boxes is not None:
        for box in r.boxes:
            cid  = int(box.cls[0])
            cf   = round(float(box.conf[0]), 4)
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            dets.append({"class_id": cid, "class_name": CLASS_NAMES[cid],
                         "confidence": cf, "bbox": {"x1":x1,"y1":y1,"x2":x2,"y2":y2}})
    ri = infer_region(dets)
    return {"count": len(dets), "detections": dets, **ri}

def run_segment(img: Image.Image, conf_thresh: float = 0.4) -> dict:
    import numpy as np
    model  = get_segmentor()
    img_np = np.array(img)[:, :, ::-1].copy()
    r      = model(img_np, conf=conf_thresh, verbose=False)[0]
    dets   = []
    if r.boxes is not None:
        for i, box in enumerate(r.boxes):
            cid  = int(box.cls[0])
            cf   = round(float(box.conf[0]), 4)
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            poly = []
            if r.masks is not None and i < len(r.masks.xy):
                poly = [[round(float(px),1), round(float(py),1)] for px,py in r.masks.xy[i]]
            dets.append({"class_id": cid, "class_name": CLASS_NAMES[cid],
                         "confidence": cf, "bbox": {"x1":x1,"y1":y1,"x2":x2,"y2":y2},
                         "mask_polygon": poly})
    ri = infer_region(dets)
    return {"count": len(dets), "detections": dets, **ri}

# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return jsonify({"status":"ok","device":DEVICE,"models_loaded":list(_models.keys())})

@app.post("/api/classify")
def classify():
    t0 = time.time()
    try:
        result = run_classify(load_image())
        result["latency_ms"] = round((time.time()-t0)*1000, 1)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        log.exception("Classify error"); return jsonify({"error": str(e)}), 500

@app.post("/api/detect")
def detect():
    t0   = time.time()
    conf = float(request.args.get("conf", 0.4))
    try:
        result = run_detect(load_image(), conf)
        result["latency_ms"] = round((time.time()-t0)*1000, 1)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        log.exception("Detect error"); return jsonify({"error": str(e)}), 500

@app.post("/api/segment")
def segment():
    t0   = time.time()
    conf = float(request.args.get("conf", 0.4))
    try:
        result = run_segment(load_image(), conf)
        result["latency_ms"] = round((time.time()-t0)*1000, 1)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        log.exception("Segment error"); return jsonify({"error": str(e)}), 500

@app.post("/api/analyze")
def analyze():
    """Run all 3 models at once and return combined results."""
    t0   = time.time()
    conf = float(request.args.get("conf", 0.4))
    try:
        img = load_image()
        clf = run_classify(img)
        det = run_detect(img, conf)
        seg = run_segment(img, conf)
        # Combine region votes from all models
        all_dets = (
            [{"class_name": clf["class_name"], "confidence": clf["confidence"]}]
            + det["detections"]
            + seg["detections"]
        )
        ri = infer_region(all_dets)
        return jsonify({
            "classification": clf,
            "detection":      det,
            "segmentation":   seg,
            **ri,
            "latency_ms": round((time.time()-t0)*1000, 1),
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        log.exception("Analyze error"); return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port  = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG","false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
