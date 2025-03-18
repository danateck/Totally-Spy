from numpy import ndarray
from ultralytics import YOLO
import logging

type CordsPoint = tuple[int,int,int,int,float]
type Image = ndarray

def find_largest_phone_from_cords(tuple_cord_points: list[CordsPoint]) -> list[CordsPoint]:
    """Finds the largest array phone (based on bounding box area)."""
    if len(tuple_cord_points) == 0:
        return []
    return [max(tuple_cord_points, key=lambda box: (box[2] - box[0]) * (box[3] - box[1]))]


def sort_by_confidence(tuple_cord_points: list[CordsPoint]) -> list[CordsPoint]:
    """Sorting the array based on a dynamic confidence threshold."""
    if len(tuple_cord_points) == 0:
        return []
    return sorted(tuple_cord_points, key=lambda box: box[4])


def get_phones_from_cords(image: Image, tuple_cord_points: list[CordsPoint]) -> list[Image]:
    """Crops detected phones from an image based on bounding box coordinates."""
    if len(tuple_cord_points) == 0:
        return []
    cropped_images = []
    for x1, y1, x2, y2, _ in tuple_cord_points:
        cropped = image[y1:y2, x1:x2]

        # Ensure the crop is valid before adding
        if cropped.shape[0] > 0 and cropped.shape[1] > 0:
            cropped_images.append(cropped)

    return cropped_images


class DetectPhone:
    MIN_CONFIDENCE = 0.3

    def __init__(self, model_path="best.pt"):
        """Initialize the YOLO model for phone detection."""
        self.model = YOLO(model_path)
        logging.getLogger("ultralytics").setLevel(logging.WARNING)

    def find_cord_for_phones(self, image: Image) -> list[CordsPoint]:
        """Detect phones in an image and return their bounding boxes and confidence scores."""
        results = self.model(image, verbose=False)
        phones = []
        for result in results[0].boxes:
            if result.conf > self.MIN_CONFIDENCE:
                x1, y1, x2, y2 = map(int, result.xyxy[0])
                phones.append((x1, y1, x2, y2, float(result.conf)))
        return phones

