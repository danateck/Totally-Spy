import cv2
import numpy as np
import tkinter as tk
from tkinter import filedialog


def enhance_image():
    # Open a file dialog to let the user choose an image
    root = tk.Tk()
    root.withdraw()  # Hide the root window
    image_path = filedialog.askopenfilename(
        title="Select an Image",
        filetypes=[("Image Files", "*.jpg;*.jpeg;*.png;*.bmp;*.tif;*.tiff")],
    )

    # Check if the user selected a file
    if not image_path:
        print("No image selected.")
        return

    # Load the image
    image = cv2.imread(image_path)

    # Check if image is loaded
    if image is None:
        print("Error: Could not load the image.")
        return

    # Resize for consistency
    scale_percent = 150  # Resize to 50% of original size for easier handling
    width = int(image.shape[1] * scale_percent / 100)
    height = int(image.shape[0] * scale_percent / 100)
    dim = (width, height)
    image_resized = cv2.resize(image, dim, interpolation=cv2.INTER_AREA)

    # Convert to grayscale
    gray = cv2.cvtColor(image_resized, cv2.COLOR_BGR2GRAY)

    # Apply Gaussian Blur to reduce noise
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Apply adaptive thresholding
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )

    # Show the original and processed images
    cv2.imshow("Original Image", image_resized)
    cv2.imshow("Enhanced Image", thresh)

    # Wait for user to close the windows
    cv2.waitKey(0)
    cv2.destroyAllWindows()


# Call the function
enhance_image()