import cv2
import pytesseract
import re

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"



video_path = 'croppedOtpVid.mov'

# define and initialzing OTP-related keywords and patterns
otp_patterns = [
    r"\bOTP\b",
    r"Your code is",
    r"Verification code",
    r"Use code",
    r"\b\d{4,8}\b"  # detect numbers of length 4 to 8 which are common OTP lengths
]

# function to check if text contains OTP-related patterns
def contains_otp(text):
    for pattern in otp_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    return False

# openingh the video file
cap = cv2.VideoCapture(video_path)
fps = cap.get(cv2.CAP_PROP_FPS)
frame_interval = int(fps * 1)  # Process one frame per second

frame_count = 0
while cap.isOpened():
    ret, frame = cap.read()
    
    if not ret:
        break
    
    # only process one frame per interval
    if frame_count % frame_interval == 0:
        # calculate the timestamp in seconds
        seconds = frame_count / fps
        
        # convert frame to gray scale for better OCR accuracy
        gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # apply OCR to extract text from the frame
        extracted_text = pytesseract.image_to_string(gray_frame)
        
        # check ifs the text contains OTP-related content
        if contains_otp(extracted_text):
            print(f"\n OTP Notification Detected at {int(seconds)} seconds")
    
    frame_count += 1

cap.release()