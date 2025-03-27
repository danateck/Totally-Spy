import httpx
import cv2  # For image processing
import pytesseract  # For OCR
import base64
import numpy as np

# Fake function for image enhancement (replace with your actual function)
def enhance_image(image_path):
    image = cv2.imread(image_path)
    # Apply enhancement (e.g., denoising, sharpening)
    return image

# Function to extract text from image
def extract_text(image):
    text = pytesseract.image_to_string(image)
    return text.strip()

# Send text to server for recognition
def send_text_to_server(text):
    server_url = "http://127.0.0.1:8000/recognize"
    response = httpx.post(server_url, json={"text": text})
    return response.json()

# Full process
def process_image(image_path):
    enhanced_image = enhance_image(image_path)
    text = extract_text(enhanced_image)
    result = send_text_to_server(text)
    return result

# Example Usage
image_path = "sample.jpg"  # Path to your image
print(process_image(image_path))
