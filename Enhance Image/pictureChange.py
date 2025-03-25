import cv2
import tkinter as tk
from tkinter import filedialog


def enhance_image():
    """
    Enhances text clarity in an image by applying contrast enhancement,
    noise reduction, sharpening, and binarization while making text slightly thinner.
    """
    image=loadPicture()
    image_resized=resizePicture(image)
    enhanced_gray=grayScale(image_resized)
    # binary=reduceNoise(enhanced_gray)
    # binary is optional, sometimes results are better without this functionality

    cv2.imshow("Original Image", image_resized)
    cv2.imshow("Enhanced Image", enhanced_gray)

    cv2.waitKey(0)
    cv2.destroyAllWindows()
    return image

def loadPicture():
    # load picture from computer
    root = tk.Tk()
    root.withdraw()  # Hide the root window
    image_path = filedialog.askopenfilename(
        title="Select an Image",
        filetypes=[("Image Files", "*.jpg;*.jpeg;*.png;*.bmp;*.tif;*.tiff")],
    )

    if not image_path:
        print("No image selected.")
        return

    # Load the image
    image = cv2.imread(image_path)
    if image is None:
        print("Error: Could not load the image.")
        return
    return image

def resizePicture(image):
    # Resize image while maintaining aspect ratio
    max_width, max_height = 1000, 400
    h, w = image.shape[:2]
    scale = min(max_width / w, max_height / h)
    new_w, new_h = int(w * scale), int(h * scale)
    image_resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
    return image_resized

def grayScale(image_resized):
    # Convert to grayscale
    gray = cv2.cvtColor(image_resized, cv2.COLOR_BGR2GRAY)

    # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) with reduced effect
    clahe = cv2.createCLAHE(clipLimit=1.2, tileGridSize=(8, 8))
    enhanced_gray = clahe.apply(gray)
    return enhanced_gray

def reduceNoise(enhanced_gray):
    # Apply Gaussian blur to reduce noise before binarization
    denoised = cv2.GaussianBlur(enhanced_gray, (3, 3), 0)
    # Apply fixed thresholding with a lower threshold value
    _, binary = cv2.threshold(denoised, 141, 225, cv2.THRESH_BINARY)
    return binary



# Run the function
enhance_image()
