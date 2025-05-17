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
create_portfolio_tables()

class UserLogin(BaseModel):
    username: str
    password: str

class UserDetails(BaseModel):
    username: str

class ImageData(BaseModel):
    image: str

class PortfolioRequest(BaseModel):
    name: str
    portfolioId: int

class SharePortfolioRequest(BaseModel):
    portfolioId: int
    targetUserId: int
    role: str = "editor"

class PortfolioScanRequest(BaseModel):
    portfolioId: int
    scanId: int


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

# Create a new portfolio owned by the current user
@app.post("/portfolio/create")
async def create_portfolio_route(portfolio_data: PortfolioRequest, user: User = Depends(get_current_user)):
    name = portfolio_data.name
    portfolio_id = add_portfolio(name, user.id)
    return {"portfolio_id": portfolio_id}

# Get all portfolios that the current user owns or is a member of. returns a list of portfolio IDs and names.
@app.get("/portfolio/list")
async def list_user_portfolios(user: User = Depends(get_current_user)):
    portfolios = get_portfolios_for_user(user.id)
    return {"portfolios": portfolios}

# Share a portfolio with another user by adding them as a member
@app.post("/portfolio/share")
async def share_portfolio(data: SharePortfolioRequest, user: User = Depends(get_current_user)):
    if not data.portfolioId or not data.targetUserId:
        raise HTTPException(status_code=400, detail="Missing portfolioId or targetUserId")
    role = get_user_role_in_portfolio(user.id, data.portfolioId)
    if role != "owner":
        raise HTTPException(status_code=403, detail="You don't have access to this portfolio action.")

    success = share_portfolio_with_user(data.portfolioId, data.targetUserId, data.role)
    return {"success": success}

# Add a scan record to a portfolio.
@app.post("/portfolio/add_scan")
async def add_scan_to_portfolio_route(data: PortfolioScanRequest, user: User = Depends(get_current_user)):
    if not data.portfolioId or not data.scanId:
        raise HTTPException(status_code=400, detail="Missing portfolioId or scanId")
    role = get_user_role_in_portfolio(user.id, data.portfolioId)
    if role == "notmember":
        raise HTTPException(status_code=403, detail="You don't have access to this portfolio.")

    added = add_scan_to_portfolio(data.portfolioId, data.scanId, user.id)
    return {"added": added}

# Remove a scan record from a portfolio. Only is allowed to remove scans.
@app.post("/portfolio/remove_scan")
async def remove_scan_from_portfolio(data: PortfolioScanRequest, user: User = Depends(get_current_user)):
    if not data.portfolioId or not data.scanId:
        raise HTTPException(status_code=400, detail="Missing portfolioId or scanId")
    role = get_user_role_in_portfolio(user.id, data.portfolioId)
    if role != "owner":
        raise HTTPException(status_code=403, detail="You don't have access to this portfolio action.")

    removed = delete_scan_from_portfolio(data.portfolioId, data.scanId)
    return {"removed": removed}

# Retrieve all scan records for a portfolio the user has access to.
@app.get("/portfolio/{portfolio_id}/scans")
async def get_scans(portfolio_id: int, user: User = Depends(get_current_user)):
    role = get_user_role_in_portfolio(user.id, portfolio_id)
    if role == "notmember":
        raise HTTPException(status_code=403, detail="Access denied")

    scans = get_scans_in_portfolio(user.id, portfolio_id)
    return {"scans": scans}

#Get the role of the current user in a specified portfolio
@app.get("/portfolio/{portfolio_id}/role")
async def get_role(portfolio_id: int, user: User = Depends(get_current_user)):
    role = get_user_role_in_portfolio(user.id, portfolio_id)
    return {"role": role}

@app.post("/portfolio/delete")
async def delete_portfolio_route(data: PortfolioRequest, user: User = Depends(get_current_user)):
    portfolio_id = data.portfolioId

    role = get_user_role_in_portfolio(user.id, portfolio_id)
    if role != "owner":
        raise HTTPException(status_code=403, detail="You are not the owner of this portfolio.")

    success = delete_portfolio(portfolio_id)
    if not success:
        raise HTTPException(status_code=404, detail="Portfolio not found or already deleted.")

    return {"deleted": success}

@app.post("/portfolio/remove_member")
async def remove_portfolio_member(
    data: SharePortfolioRequest,  # Reuse or create a new one with userId to remove
    user: User = Depends(get_current_user)
):
    portfolio_id = data.portfolioId
    user_id_to_remove = data.targetUserId

    if not portfolio_id or not user_id_to_remove:
        raise HTTPException(status_code=400, detail="Missing portfolioId or targetUserId")

    success = remove_member_from_portfolio(portfolio_id, user_id_to_remove, user.id)
    if not success:
        raise HTTPException(status_code=403, detail="You are not allowed to remove members.")
    
    return {"removed": success}

@app.get("/portfolio/{portfolio_id}/members")
async def list_portfolio_members(portfolio_id: int, user: User = Depends(get_current_user)):
    role = get_user_role_in_portfolio(user.id, portfolio_id)
    if role == "notmember":
        raise HTTPException(status_code=403, detail="You are not a member of this portfolio.")
    
    members = get_portfolio_members(portfolio_id)
    return {"members": members}

    

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
    


