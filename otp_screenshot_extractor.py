
import cv2
import numpy as np
import os

def calculate_sharpness(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var()

def calculate_contrast(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return gray.std()

def calculate_colorfulness(image):
    (B, G, R) = cv2.split(image.astype("float"))
    rg = np.abs(R - G)
    yb = np.abs(0.5 * (R + G) - B)
    return np.sqrt(np.std(rg)**2 + np.std(yb)**2) + (0.3 * np.sqrt(np.mean(rg)**2 + np.mean(yb)**2))

def score_image(image):
    sharp = calculate_sharpness(image)
    contrast = calculate_contrast(image)
    color = calculate_colorfulness(image)
    return sharp * 0.5 + contrast * 0.3 + color * 0.2

def extract_best_frame(video_path, output_folder, start_sec, end_sec, interval=0.5, session_name="session"):
    cap = cv2.VideoCapture(video_path)
    os.makedirs(output_folder, exist_ok=True)
    os.makedirs("otp_best", exist_ok=True)

    best_score = -1
    best_frame = None
    best_time = None

    current_time = start_sec
    while current_time <= end_sec:
        cap.set(cv2.CAP_PROP_POS_MSEC, current_time * 1000)
        ret, frame = cap.read()
        if not ret:
            break

        score = score_image(frame)
        if score > best_score:
            best_score = score
            best_frame = frame
            best_time = current_time

        filename = f"{session_name}_screenshot_{int(current_time*10)}.jpg"
        cv2.imwrite(os.path.join(output_folder, filename), frame)
        current_time += interval

    cap.release()

    if best_frame is not None:
        best_path = os.path.join("otp_best", f"{session_name}_best_at_{int(best_time)}s.jpg")
        cv2.imwrite(best_path, best_frame)
        print(f"✅ Best frame saved for {session_name} at {best_time:.2f}s → {best_path}")

def process_otp_screenshots(video_path, times_file="otp_times.txt"):
    with open(times_file, "r") as f:
        ranges = [line.strip().split(",") for line in f.readlines()]

    for idx, (start, end) in enumerate(ranges):
        extract_best_frame(
            video_path,
            output_folder=f"otp_screenshots/session_{idx+1}",
            start_sec=float(start),
            end_sec=float(end),
            session_name=f"session_{idx+1}"
        )

if __name__ == "__main__":
    process_otp_screenshots("videos/otp_video.mp4")
