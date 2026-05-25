import gdown, os

os.makedirs("models", exist_ok=True)

files = {
    "models/modesty_classifier_best.pt": "https://drive.google.com/file/d/1XB8L65xi7B_A-XO6Eb1sea0xi9ZGHb8C/view?usp=sharing",
    "models/modesty_detector_best.pt":   "https://drive.google.com/file/d/1x88i7OiY5EBdQLtBUvZVJ3X-kPQIEIVT/view?usp=sharing",
    "models/modesty_segmentor_best.pt":  "https://drive.google.com/file/d/1YwQlnqY4qJ4iirxMjewLRW2zIu1uiLhK/view?usp=sharing",
}

for path, fid in files.items():
    if not os.path.exists(path):
        print(f"Downloading {path}...")
        gdown.download(f"https://drive.google.com/uc?id={fid}", path, quiet=False)
    else:
        print(f"Already exists: {path}")

os.system("gunicorn app:app --bind 0.0.0.0:5000 --timeout 120")