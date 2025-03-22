import threading

from google.cloud import vision

from OCR import OCR

class OCRManager:
    """Singleton class to manage the Google Vision API client."""
    _instance = None
    _lock = threading.Lock()
    json_name = "../env/majestic-gizmo-454416-v6-e5c5d587f26b.json"

    def __new__(cls, json_key_file=json_name):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(OCRManager, cls).__new__(cls)
                cls._instance.client = vision.ImageAnnotatorClient.from_service_account_file(json_key_file)
                cls._instance.ocr = OCR(cls._instance.client)
        return cls._instance

    def get_client(self):
        return self.client

    def extract_text(self, img):
        """Extracts text from an image using the OCR class."""
        return self.ocr.extract_text(img)