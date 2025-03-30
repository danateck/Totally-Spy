from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from Data_recognition.data_type_recognition import classify_text
from Enhance_Image.pictureChange import enhance_image
import numpy as np
import base64
from io import BytesIO
from PIL import Image
from fastapi.middleware.cors import CORSMiddleware
from OCR.OCRManager import *
from database.database_handler import *
import logging

app = FastAPI()
ocr_manager = OCRManager()

# Allow frontend running on port 3000 to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods like GET, POST, etc.
    allow_headers=["*"],  # Allows all headers
)

# On server start, ensure the user table is created
create_users_table()
create_scan_history_table()
current_user = None


def convert_to_formatted_string(detected_texts: list[tuple[str, str]]) -> str:
    # Join each tuple into a single line with label and value separated by ':'
    formatted_string = '\n'.join(f"{label}:{value}" for label, value in detected_texts)
    return formatted_string


# Function to process the extracted text and detect data (e.g., OTP)
# Function to decode the base64 frame data to an OpenCV-compatible image
def decode_base64_frame(base64_frame):
    img_data = base64.b64decode(base64_frame)
    img = Image.open(BytesIO(img_data))
    return np.array(img)


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    global current_user
    await ws.accept()
    video_started = False
    try:
        while True:
            # Wait for the client to send a message indicating if video is being sent
            message = await ws.receive_text()

            if message == "video_start":
                video_started = True
                continue
            elif message == "login_start":
                # Notify server to process login
                await handle_login(ws)
                continue
            elif message == "create_user_start":
                # Notify server to process user creation
                await handle_create_user(ws)
                continue

            if video_started:
                # If video data is being sent
                base64_frame = message  # Frame data is received here

                # Decode the base64 frame into ndarray (OpenCV-compatible image)
                frame = decode_base64_frame(base64_frame)

                # Process the frame to extract text and detect relevant data (e.g., OTP)
                enhanced_image = enhance_image(frame)
                extracted_text = ocr_manager.extract_text(enhanced_image)
                detected_data = classify_text(extracted_text[0])
                str_data = convert_to_formatted_string(detected_data)  # convert list to string format
                insert_scan(current_user, str_data)  # insert to database

                if detected_data:
                    # Send the detected data back to the client
                    await ws.send_json(detected_data)
                else:
                    await ws.send_text("No data detected.")

    except WebSocketDisconnect:
        logging.info("Client disconnected.")
        await ws.close()
    except Exception as e:
        logging.error(f"Error: {e}")
        await ws.close()


async def handle_login(ws: WebSocket):
    try:
        # Receive login data
        login_data = await ws.receive_json()  # Expected format: {"username": "user", "password": "pass"}
        username = login_data["username"]
        password = login_data["password"]

        # Call the database function to log in
        if login_user(username, password):
            await ws.send_text("Login successful.")
            current_user = username
        else:
            await ws.send_text("Login failed.")
    except Exception as e:
        logging.error(f"Error during login: {e}")
        await ws.send_text("Error during login.")


async def handle_create_user(ws: WebSocket):
    try:
        # Receive user creation data
        create_user_data = await ws.receive_json()  # Expected format: {"username": "user", "password": "pass"}
        username = create_user_data["username"]
        password = create_user_data["password"]

        # Call the database function to create a new user
        user_id = insert_user(username, password)
        if user_id:
            await ws.send_text(f"User created with ID: {user_id}")
        else:
            await ws.send_text("User creation failed.")
    except Exception as e:
        logging.error(f"Error during user creation: {e}")
        await ws.send_text("Error during user creation.")
