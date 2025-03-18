import cv2
from ultralytics import YOLO
import logging

logging.getLogger("ultralytics").setLevel(logging.WARNING)

model = YOLO('best.pt')

cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

if not cap.isOpened():
    print("Error: Could not open camera.")
else:
    print("Press 'q' to quit the live feed.")

    while True:
        ret, frame = cap.read()

        if not ret:
            print("Error: Failed to capture frame.")
            break

        results = model(frame, verbose=False)

        filtered_boxes = []
        for result in results[0].boxes:
            if result.conf > 0.5:
                filtered_boxes.append(result.xyxy)

        if filtered_boxes:
            annotated_frame = results[0].plot()
        else:
            annotated_frame = frame

        cv2.imshow('YOLOv8 Detection', annotated_frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()

cv2.destroyAllWindows()
