from fastapi import FastAPI, WebSocket
from Data_recognition.data_type_recognition import classify_text
from Enhance_Image.pictureChange import enhance_image
import numpy as np
import base64
from io import BytesIO
from PIL import Image
from fastapi.middleware.cors import CORSMiddleware
from OCR.OCRManager import *
from Data_recognition.data_type_recognition import classify_text
from database.database_handler import *
app = FastAPI()
ocr_manager=OCRManager()


# Allow frontend running on port 3000 to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend's URL
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods like GET, POST, etc.
    allow_headers=["*"],  # Allows all headers
)


# Function to process the extracted text and detect data (e.g., OTP)



# Function to decode the base64 frame data to an OpenCV-compatible image
def decode_base64_frame(base64_frame):
    img_data = base64.b64decode(base64_frame)
    img = Image.open(BytesIO(img_data))
    return np.array(img)


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            # Wait for the client to send the frame (base64 encoded image)
            base64_frame = await ws.receive_text()  # Expecting base64 encoded frame

            # Decode the base64 frame into an ndarray (OpenCV-compatible image)
            frame = decode_base64_frame(base64_frame)

            # Process the frame to extract text and detect relevant data (e.g., OTP)
            enhanced_image=enhance_image(frame)
            extracted_text = ocr_manager.extract_text(enhanced_image)
            detected_data = classify_text(extracted_text[0])

            if detected_data:
                # Send the detected data back to the client
                await ws.send_json(detected_data)

    except Exception as e:
        print(f"Error: {e}")
        await ws.close()
