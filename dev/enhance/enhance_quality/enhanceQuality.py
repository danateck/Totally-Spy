import cv2
import numpy as np
import pytesseract
from numpy import ndarray
def enhance_image(image: ndarray) -> ndarray:
    resized = resize_picture(image)
    gray = gray_scale(resized)
    denoised = adaptive_threshold(gray)

    score_gray = get_ocr_score(gray)
    score_denoised = get_ocr_score(denoised)

    print(f"Score - Gray: {score_gray:.2f} | Denoised: {score_denoised:.2f}")
    return gray if score_gray >= score_denoised else denoised




def resize_picture(image: ndarray) -> ndarray:
    # Upscale for better OCR, but keep aspect ratio
    return cv2.resize(image, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)


def gray_scale(image: ndarray) -> ndarray:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    # Light CLAHE enhancement (optional)
    clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
    return clahe.apply(gray)


def adaptive_threshold(image_gray: ndarray) -> ndarray:
    # Adaptive thresholding with noise cleanup
    binary = cv2.adaptiveThreshold(
        image_gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        blockSize=11,
        C=2
    )
    # Clean small noise
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    cleaned = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    return cleaned


def get_ocr_confidence(image: ndarray) -> float:
    ocr_data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
    confidences = [
        int(conf) if isinstance(conf, str) and conf.isdigit() else conf
        for conf in ocr_data['conf']
        if isinstance(conf, (int, str)) and str(conf).strip().isdigit()
    ]
    return sum(confidences) / len(confidences) if confidences else 0

import string

def get_ocr_score(image: ndarray) -> float:
    ocr_data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
    confidences = []
    valid_chars = 0

    for i, conf in enumerate(ocr_data["conf"]):
        try:
            conf_val = int(conf)
            text = ocr_data["text"][i].strip()
            if conf_val > 0 and any(c.isalnum() for c in text):
                confidences.append(conf_val)
                valid_chars += len(text)
        except ValueError:
            continue

    avg_conf = sum(confidences) / len(confidences) if confidences else 0
    return avg_conf + 0.2 * valid_chars  # Give weight to actual readable content


def __main__():
    image_path = "C:/Users/medin/Downloads/try1.jpeg"
    image = cv2.imread(image_path)

    if image is None:
        print("Error: Image not loaded. Check the file path!")
    else:
        print("Image loaded successfully!")
        enhanced = enhance_image(image)

        # Show result
        cv2.imshow("Enhanced Image", enhanced)
        cv2.waitKey(0)
        cv2.destroyAllWindows()


if __name__ == "__main__":
    __main__()
