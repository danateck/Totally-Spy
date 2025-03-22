
import cv2
from google.cloud import vision
from numpy import ndarray

type TextRecognition =  list[dict[str,Cords]] #list[word,cords]
type Cords = tuple[int, int] #tuple[x,y]

class OCR:
    def __init__(self, client):
        self.client = client

    def extract_text(self, img: ndarray) -> tuple[str,TextRecognition]:
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
            return "", []

        # Full text from the first text annotation
        full_text = texts[0].description

        # Extract words and their bounding boxes
        word_data = [
            {"word": text.description, "cords": [(v.x, v.y) for v in text.bounding_poly.vertices]}
            for text in texts[1:]  # Skip first entry since it's the full text
        ]

        return full_text, word_data

    def _convert_cv2_to_bytes(self, img: ndarray) -> bytes:
        """
        Converts an OpenCV image (NumPy array) to bytes for use with Google Vision API.
        :param img: The image to convert.
        :return: bytes: The image in byte format.
        """
        _, encoded_image = cv2.imencode(".jpg", img)
        return encoded_image.tobytes()