import cv2
from numpy import ndarray



def enhance_image(image) -> ndarray| None:
    """
    Enhances text clarity in an image by applying contrast enhancement,
    noise reduction, sharpening, and binarization while making text slightly thinner.
    """
    image_resized=resizePicture(image)
    enhanced_gray=grayScale(image_resized)
    # binary=reduceNoise(enhanced_gray)
    # binary is optional, sometimes results are better without this functionality

    cv2.waitKey(0)
    cv2.destroyAllWindows()
    return enhanced_gray

def resizePicture(image) -> ndarray | None:
    # Resize image while maintaining aspect ratio
    max_width, max_height = 1000, 400
    h, w = image.shape[:2]
    scale = min(max_width / w, max_height / h)
    new_w, new_h = int(w * scale), int(h * scale)
    image_resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
    return image_resized

def grayScale(image_resized) -> ndarray | None :
    # Convert to grayscale
    gray = cv2.cvtColor(image_resized, cv2.COLOR_BGR2GRAY)

    # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) with reduced effect
    clahe = cv2.createCLAHE(clipLimit=1.2, tileGridSize=(8, 8))
    enhanced_gray = clahe.apply(gray)
    return enhanced_gray

def reduceNoise(enhanced_gray) -> ndarray | None:
    # Apply Gaussian blur to reduce noise before binarization
    denoised = cv2.GaussianBlur(enhanced_gray, (3, 3), 0)
    # Apply fixed thresholding with a lower threshold value
    _, binary = cv2.threshold(denoised, 141, 225, cv2.THRESH_BINARY)
    return binary



