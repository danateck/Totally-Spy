import threading

from google.cloud import vision
from numpy import ndarray

from OCR.OCR import OCR, TextRecognition


class OCRManager:
    """Singleton class to manage the Google Vision API client."""
    _instance = None
    _lock = threading.Lock()
    json_name = "./env/google-vision-api.json"

    def __new__(cls, json_key_file=json_name):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(OCRManager, cls).__new__(cls)
                cls._instance.client = vision.ImageAnnotatorClient.from_service_account_file(json_key_file)
                cls._instance.ocr = OCR(cls._instance.client)
        return cls._instance

    def get_client(self):
        return self.client

    def extract_text(self, img: ndarray) -> tuple[str,TextRecognition]:
        """
        Extracts text and bounding box coordinates from an image using Google Cloud Vision API.
        :param img: The image as an OpenCV format.
        :return: list: A list containing two elements:
                         1. Full text from text_annotations.description
                         2. List of words with their bounding box coordinates
        """
        return self.ocr.extract_text(img)