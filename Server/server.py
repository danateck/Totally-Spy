import base64
import uuid
import os
from io import BytesIO

import numpy as np
from PIL import Image
from fastapi import Depends, FastAPI, Cookie, Response, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel

from Data_recognition.data_type_recognition import classify_text
from Enhance_Image.pictureChange import enhance_image
from OCR.OCRManager import OCRManager
from database.database_handler import *
from YOLO8.detect_phone import DetectPhone, get_phones_from_cords, find_largest_phone_from_cords

app = FastAPI()
ocr_manager = OCRManager()
detector = DetectPhone('./YOLO8/best.pt')
client_path = "../Client/dist/"

# Get client URL from environment variable or use default
CLIENT_URL = os.getenv('CLIENT_URL', 'http://localhost:5173')

# Allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[CLIENT_URL],  # Frontend URL from environment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# On server start, ensure the user table is created
create_users_table()
create_scan_history_table()
create_session_table()

class UserLogin(BaseModel):
    username: str
    password: str

class UserDetails(BaseModel):
    username: str

class ImageData(BaseModel):
    image: str

def convert_to_formatted_string(detected_texts: list[tuple[str, str]]) -> str:
    # Join each tuple into a single line with label and value separated by ':'
    formatted_string = '\n'.join(f"{label}:{value}" for label, value in detected_texts)
    return formatted_string

def get_current_user(session_id: Optional[str] = Cookie(None)) -> User:
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session ID cookie missing"
        )
    
    user = get_session(session_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session or user not found"
        )
    
    return user

# Function to decode the base64 frame data to an OpenCV-compatible image
def decode_base64_frame(base64_frame):
    img_data = base64.b64decode(base64_frame)
    img = Image.open(BytesIO(img_data))
    return np.array(img)

# Mount the static files directory
app.mount("/static", StaticFiles(directory=client_path), name="public")

@app.post("/record/img")
async def search_info(image_data: ImageData, user: User = Depends(get_current_user)):
        # Decode the base64 frame into ndarray (OpenCV-compatible image)
        frame = decode_base64_frame(image_data.image)
    
        # Process the frame to extract text and detect relevant data (e.g., OTP)
        
        cord_cropped_image = detector.find_cord_for_phones(frame)
        cropped_image = get_phones_from_cords(frame, find_largest_phone_from_cords(cord_cropped_image))
        if len(cropped_image) > 0:
            cropped_image = cropped_image[0]
        else:
            raise HTTPException(status_code=404, detail="No phone found.")
        enhanced_image = enhance_image(cropped_image)
        extracted_text = ocr_manager.extract_text(enhanced_image)
        detected_data = classify_text(extracted_text[0])
        str_data = convert_to_formatted_string(detected_data) 
        insert_scan(user.username, str_data)

        if detected_data:
            return {"message": detected_data}
        else:
            raise HTTPException(status_code=404, detail="No data found.")


@app.post("/auth/login")
async def login(login_data: UserLogin, response: Response):
    try:
        # Receive login data
        username = login_data.username
        password = login_data.password

        # Call the database function to log in
        if login_user(username, password):
            # Create a session cookie
            session_id = str(uuid.uuid4())  # Generate a unique session ID
            insert_session(get_user_id(username), session_id)
            response.set_cookie(key="session_id", value=session_id, httponly=True)  # Set cookie

            return {"message": "Login successful", "session_id": session_id}
        else:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    except Exception as e:
        logging.error(f"Error during login: {e}")
        raise HTTPException(status_code=500, detail="Error during login.")


@app.post("/auth/signup")
async def create_user(create_user_data: UserLogin, response: Response):
    try:
        # Receive user creation data
        username = create_user_data.username
        password = create_user_data.password

        # Call the database function to create a new user
        user_id = insert_user(username, password)
        if user_id:
            session_id = str(uuid.uuid4())  # Generate a unique session ID
            insert_session(user_id, session_id)
            response.set_cookie(key="session_id", value=session_id, httponly=True)  # Set cookie
            return {"message": f"User created successfully with ID: {user_id}"}
        else:
            raise HTTPException(status_code=400, detail="User creation failed")
    except Exception as e:
        logging.error(f"Error during user creation: {e}")
        raise HTTPException(status_code=500, detail="Error during user creation.")

@app.get("/history/recordings")
async def get_records(user: User = Depends(get_current_user)):
    records = get_scan_history(user.username)
    return {"records": records}

@app.get("/history/record/{record_id}")
async def get_record(record_id: int, user: User = Depends(get_current_user)):
    record = get_scan_history_by_id(user.id, record_id)
    return {"record": record}

@app.get("/", response_class=FileResponse)
async def serve_index():
    # Serve React's index.html for any unknown route
    return FileResponse(client_path + "index.html")

@app.get("/{full_path:path}", response_class=FileResponse)
async def serve_spa(full_path: str):
    # Serve React's index.html for any unknown route
    return FileResponse(client_path + "index.html")