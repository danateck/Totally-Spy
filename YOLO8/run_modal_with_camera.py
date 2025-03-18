import cv2
import numpy as np

from YOLO8.detect_phone import DetectPhone, get_phones_from_cords, find_largest_phone_from_cords

cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
find_phones = DetectPhone()
if not cap.isOpened():
    print("Error: Could not open camera.")
else:
    print("Press 'q' to quit the live feed.")

    while True:
        ret, frame = cap.read()

        if not ret:
            print("Error: Failed to capture frame.")
            break

        cords = find_phones.find_cord_for_phones(frame)
        results = get_phones_from_cords(frame, find_largest_phone_from_cords(cords))

        if len(results) == 0:
            output_frame = np.zeros_like(frame)
        else:
            output_frame = results[0]

        if output_frame.shape[0] > 0 and output_frame.shape[1] > 0:
            output_frame = cv2.resize(output_frame, (400, 400))

        cv2.imshow('Phone Detection', output_frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()

cv2.destroyAllWindows()
