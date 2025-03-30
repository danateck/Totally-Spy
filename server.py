import base64
import uuid
from io import BytesIO

import numpy as np
from PIL import Image
from fastapi import FastAPI, WebSocket, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from Data_recognition.data_type_recognition import classify_text
from Enhance_Image.pictureChange import enhance_image
from OCR.OCRManager import OCRManager
from database.database_handler import *

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


# Model for receiving login data
class LoginRequest(BaseModel):
    username: str
    password: str


# Model for receiving user creation data
class CreateUserRequest(BaseModel):
    username: str
    password: str


def convert_to_formatted_string(detected_texts: list[tuple[str, str]]) -> str:
    # Join each tuple into a single line with label and value separated by ':'
    formatted_string = '\n'.join(f"{label}:{value}" for label, value in detected_texts)
    return formatted_string


# Function to decode the base64 frame data to an OpenCV-compatible image
def decode_base64_frame(base64_frame):
    img_data = base64.b64decode(base64_frame)
    img = Image.open(BytesIO(img_data))
    return np.array(img)


@app.post("/api/video")
async def websocket_endpoint(ws: WebSocket):
    global current_user
    await ws.accept()
    try:

        # Receive frame data from client
        base64_frame = await ws.receive_text()

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

    except Exception as e:
        logging.error(f"Error: {e}")
        await ws.close()


@app.post("/api/login")
async def login(login_data: LoginRequest, response: Response):
    global current_user
    try:
        # Receive login data
        username = login_data.username
        password = login_data.password

        # Call the database function to log in
        if login_user(username, password):
            current_user = username

            # Create a session cookie
            session_id = str(uuid.uuid4())  # Generate a unique session ID
            response.set_cookie(key="session_id", value=session_id, httponly=True)  # Set cookie

            return {"message": "Login successful", "session_id": session_id}
        else:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    except Exception as e:
        logging.error(f"Error during login: {e}")
        raise HTTPException(status_code=500, detail="Error during login.")


@app.post("/api/create_user")
async def create_user(create_user_data: CreateUserRequest):
    try:
        # Receive user creation data
        username = create_user_data.username
        password = create_user_data.password

        # Call the database function to create a new user
        user_id = insert_user(username, password)
        if user_id:
            return {"message": f"User created successfully with ID: {user_id}"}
        else:
            raise HTTPException(status_code=400, detail="User creation failed")
    except Exception as e:
        logging.error(f"Error during user creation: {e}")
        raise HTTPException(status_code=500, detail="Error during user creation.")


# To read the cookie in a request
@app.get("/api/protected")
async def protected_route(request: Request):
    session_id = request.cookies.get("session_id")  # Get the cookie
    if not session_id:
        raise HTTPException(status_code=403, detail="Not authenticated")
    return {"message": "Welcome to the protected route!", "session_id": session_id}
