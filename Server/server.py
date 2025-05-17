import base64
import uuid
from io import BytesIO
import os
from pathlib import Path

import numpy as np
from PIL import Image
from fastapi import Depends, FastAPI, Cookie, Response, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
import cv2

from Data_recognition.data_type_recognition import classify_text
from Enhance_Image.pictureChange import enhance_image
from OCR.OCRManager import OCRManager
from database.database_handler import *
from YOLO8.detect_phone import DetectPhone, get_phones_from_cords, find_largest_phone_from_cords

app = FastAPI()
ocr_manager = OCRManager()
detector = DetectPhone('./YOLO8/best.pt')
client_path = "../Client/dist/"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "https://totallyspy.xyz"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods like GET, POST, etc.
    allow_headers=["*"],  # Allows all headers
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
    # Convert PIL Image to numpy array and convert RGB to BGR
    frame = np.array(img)
    # Convert RGB to BGR (OpenCV format)
    frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
    return frame

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
            raise HTTPException(status_code=201, detail="No phone found.")
        enhanced_image = enhance_image(cropped_image)
        extracted_text = ocr_manager.extract_text(enhanced_image)
        detected_data = classify_text(extracted_text[0])
        str_data = convert_to_formatted_string(detected_data) 
        insert_scan(user.username, str_data)

        if detected_data:
            return {"message": detected_data}
        else:
            raise HTTPException(status_code=202, detail="No data found.")


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

@app.post("/api/user/delete")
async def delete_current_user(user: User = Depends(get_current_user)):
    try:
        # Remove user session first (optional cleanup)
        delete_sessions_for_user(user.id)
        
        # Remove user from database
        delete_user(user.username)
        
        return {"message": "User deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to delete user")
    
@app.get("/api/user/profile")
async def get_user_profile(user: User = Depends(get_current_user)):
    try:
        # Use user.id instead of username
        scan_count = get_scan_count_for_user(user.id)
        
        # Create user data object
        user_data = {
            "username": user.username,
            # You might not have these fields, customize as needed
            "joinDate": user.created_at if hasattr(user, 'created_at') else None,
            "totalRecordings": scan_count,
            "lastActive": "Today"  # Or implement a way to track last activity
        }
        
        return {"user": user_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch user profile: {str(e)}")

@app.post("/history/delete")
async def delete_history_record(request: Request, user: User = Depends(get_current_user)):
    try:
        data = await request.json()
        record_id = data.get("recordId")
        action = data.get("action")
        
        if not record_id or action != "delete":
            raise HTTPException(status_code=400, detail="Invalid request")
        
        # Call the database function to delete the record
        success = delete_record(record_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Record not found or already deleted")
            
        return {"message": "Record deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete record: {str(e)}")
    

@app.get("/{full_path:path}", response_class=FileResponse)
async def serve_spa(full_path: str):
    # Remove any leading slashes and normalize the path
    normalized_path = full_path.lstrip('/')
    
    # Construct the full file path within the client directory
    file_path = os.path.join(client_path, normalized_path)
    
    # Check if the file exists and is within the client directory
    if os.path.exists(file_path) and os.path.commonpath([os.path.abspath(file_path), os.path.abspath(client_path)]) == os.path.abspath(client_path):
        return FileResponse(file_path)
    else:
        return FileResponse(client_path + "index.html")
    


