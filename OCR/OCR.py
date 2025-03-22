import string

import cv2
from google.cloud import vision
from numpy import ndarray

type TextRecognition =  list[Cords]
type Cords = tuple[string, int]

class OCR:
    def __init__(self, client):
        self.client = client

    def extract_text(self, img: ndarray) -> tuple[string,TextRecognition]:
        """
        Extracts text and bounding box coordinates from an image using Google Cloud Vision API.
        :param img: The image as an OpenCV format.
        :return: list: A list containing two elements:
                         1. Full text from text_annotations.description
                         2. List of words with their bounding box coordinates
        """
        image_bytes = self._convert_cv2_to_bytes(img)  # Convert OpenCV image to bytes
        vision_image = vision.Image(content=image_bytes) # Convert bytes to image with format of google

        # Call the Vision API to detect text in the image
        response = self.client.text_detection(image=vision_image)
        texts = response.text_annotations  # Full text annotations (all recognized text)

        # If no text is detected, return empty lists
        if not texts:
            return [], []

        # Full text from the first text annotation
        full_text = texts[0].description

        # List to store words and their bounding box coordinates
        word_data = []

        # Iterate through the pages, blocks, paragraphs, and words
        if response.full_text_annotation.pages:
            for page in response.full_text_annotation.pages:
                for block in page.blocks:
                    for paragraph in block.paragraphs:
                        for word in paragraph.words:
                            word_text = ''.join([symbol.text for symbol in word.symbols])  # Combine word symbols
                            vertices = word.bounding_box.vertices  # Bounding box coordinates
                            word_data.append((word_text, vertices))

        return full_text, word_data

    def _convert_cv2_to_bytes(self, img: ndarray) -> bytes:
        """
        Converts an OpenCV image (NumPy array) to bytes for use with Google Vision API.
        :param img: The image to convert.
        :return: bytes: The image in byte format.
        """
        _, encoded_image = cv2.imencode(".jpg", img)
        return encoded_image.tobytes()