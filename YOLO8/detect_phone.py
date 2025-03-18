from ultralytics import YOLO
import logging

def find_largest_phone_from_cords(list_cord_points):
    """Finds the largest detected phone (based on bounding box area)."""
    if len(list_cord_points) == 0:
        return []
    return [max(list_cord_points, key=lambda box: (box[2] - box[0]) * (box[3] - box[1]))]


def filter_by_confidence(list_cord_points):
    """Filters detections based on a dynamic confidence threshold."""
    if len(list_cord_points) == 0:
        return []
    return sorted(list_cord_points, key=lambda box: box[4])


def get_phones_from_cords(image, list_cord_points):
    """Crops detected phones from an image based on bounding box coordinates."""
    if len(list_cord_points) == 0:
        return []
    cropped_images = []
    for x1, y1, x2, y2, _ in list_cord_points:
        cropped = image[y1:y2, x1:x2]

        # Ensure the crop is valid before adding
        if cropped.shape[0] > 0 and cropped.shape[1] > 0:
            cropped_images.append(cropped)

    return cropped_images


class DetectPhone:
    min_confidence = 0.3

    def __init__(self, model_path="best.pt"):
        """Initialize the YOLO model for phone detection."""
        self.model = YOLO(model_path)
        logging.getLogger("ultralytics").setLevel(logging.WARNING)

    def find_cord_for_phones(self, image):
        """Detect phones in an image and return their bounding boxes and confidence scores."""
        results = self.model(image, verbose=False)
        phones = []
        for result in results[0].boxes:
            if result.conf > self.min_confidence:
                x1, y1, x2, y2 = map(int, result.xyxy[0])
                phones.append((x1, y1, x2, y2, float(result.conf)))
        return phones

