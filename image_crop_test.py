import cv2
import pytesseract

# load the pic
image = cv2.imread('otp_image.png')

# Tesseract - identify the text place
h, w, _ = image.shape
boxes = pytesseract.image_to_boxes(image)

for b in boxes.splitlines():
    b = b.split()
    x, y, x2, y2 = int(b[1]), int(b[2]), int(b[3]), int(b[4])
    cropped_image = image[h-y2:h-y, x:x2]  # openCV
    cv2.imwrite('cropped_text.png', cropped_image)
    break  # heree we crop the first feild


