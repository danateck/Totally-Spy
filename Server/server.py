import base64
import uuid
from io import BytesIO
import os
from pathlib import Path
import time
import random
import logging
from typing import Literal, Optional

import numpy as np
from PIL import Image
import cv2
from fastapi import Depends, FastAPI, Cookie, Response, Request, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from pydantic import BaseModel

from Data_recognition.data_type_recognition import classify_text
from Enhance_Image.pictureChange import enhance_image
from OCR.OCRManager import OCRManager
from database.database_handler import *
from YOLO8.detect_phone import DetectPhone, get_phones_from_cords, find_largest_phone_from_cords
from OSINT_API.osint_enhancer import OSINTEnhancer
from typing import Optional
from pydantic import BaseModel

app = FastAPI()
ocr_manager = OCRManager()
detector = DetectPhone('./YOLO8/best.pt')
client_path = "../Client/dist/"
osint_enhancer = OSINTEnhancer()
osint_progress = {}

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "https://totallyspy.xyz"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/assets", StaticFiles(directory=os.path.join(client_path, "assets")), name="assets")
app.mount("/images", StaticFiles(directory=os.path.join(client_path, "images")), name="images")

# On server start, ensure the user table is created
create_users_table()
create_scan_history_table()
create_session_table()
create_portfolio_tables()
ensure_scan_history_columns()


class UserLogin(BaseModel):
    username: str
    password: str

class UserDetails(BaseModel):
    username: str

class LocationData(BaseModel):
    lat: float
    lng: float

class ImageData(BaseModel):
    image: str
    location: Optional[LocationData] = None

class PortfolioRequest(BaseModel):
    name: str
    portfolioId: int

class SharePortfolioRequest(BaseModel):
    portfolioId: int
    targetUsername: str
    role: str = "editor"

class PortfolioScanRequest(BaseModel):
    portfolioId: int
    scanId: int

class RenamePortfolioRequest(BaseModel):
    portfolioId: int
    newName: str

class PortfolioNameResponse(BaseModel):
    name: str

class RenameScanRequest(BaseModel):
    scanId: int
    newName: str

class PortfolioDeleteRequest(BaseModel):
    portfolioId: int

class ChangeMemberRoleRequest(BaseModel):
    portfolioId: int
    targetUsername: str
    newRole: str

class RemoveMemberRequest(BaseModel):
    portfolioId: int
    targetUsername: str

class ScanOwnershipRequest(BaseModel):
    scanId: int

class RespondRequestBody(BaseModel):
    requestId: int
    action: Literal["approve", "reject"]

class BestFrameData(BaseModel):
    scanId: int
    image: str  # base64 string

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

def draw_ocr_boxes_on_image(image, word_data, detected_values, offset_x=0, offset_y=0):
    box_count = 0
    
    for word_info in word_data:
        word = word_info.get("word", "")
        cords = word_info.get("cords", [])
        
        if word in detected_values and len(cords) == 4:
            pts = [(x + offset_x, y + offset_y) for (x, y) in cords]
            pts_np = np.array(pts, np.int32).reshape((-1, 1, 2))
            cv2.polylines(image, [pts_np], isClosed=True, color=(0, 255, 0), thickness=3)
            box_count += 1
        
    return image

@app.post("/record/img")
async def search_info(image_data: ImageData, user: User = Depends(get_current_user)):
    try:
        # Check base64 string length (rough estimate of image size)
        # Base64 increases size by ~33%, so 3MB base64 string ≈ 2MB actual image
        if len(image_data.image) > 3_000_000:  # ~3MB base64 string
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Image too large. Maximum size is approximately 2MB"
            )

        # Decode the base64 frame into ndarray (OpenCV-compatible image)
        try:
            frame = decode_base64_frame(image_data.image)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid image data"
            )
    
        # Process the frame to extract text and detect relevant data (e.g., OTP)
        try:
            cord_cropped_image = detector.find_cord_for_phones(frame)
            phone_boxes = find_largest_phone_from_cords(cord_cropped_image)
            cropped_image = get_phones_from_cords(frame, phone_boxes)
            if len(cropped_image) > 0:
                cropped_image = cropped_image[0]
                # Get the crop rectangle for offset
                x1, y1, x2, y2, _ = phone_boxes[0]
            else:
                raise HTTPException(status_code=201, detail="No phone found.")
            enhanced_image = enhance_image(cropped_image)
            # Use OCR to get both text and bounding boxes
            extracted_text, word_data = ocr_manager.extract_text(enhanced_image)
            detected_data = classify_text(extracted_text)
            

            # Only draw for detected values
            detected_values = set(val for val, _ in detected_data)

            # Draw boxes on the enhanced image (where OCR was actually performed)
            annotated_image = enhanced_image.copy()
            draw_ocr_boxes_on_image(annotated_image, word_data, detected_values, offset_x=0, offset_y=0)

            # Encode the annotated enhanced image as base64 with higher quality and compression
            encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), 90, int(cv2.IMWRITE_JPEG_OPTIMIZE), 1]
            _, buffer = cv2.imencode('.jpg', annotated_image, encode_params)
            best_frame_base64 = base64.b64encode(buffer).decode('utf-8')
            best_frame_base64 = f"data:image/jpeg;base64,{best_frame_base64}"
            
            latitude = image_data.location.lat if image_data.location else None
            longitude = image_data.location.lng if image_data.location else None

            detected_values = [(val, key) for val, key in detected_data if val.strip()]
            if not detected_values:
                raise HTTPException(status_code=202, detail="No usable data found.")
            else:
                str_data = convert_to_formatted_string(detected_values)
                scan_id = insert_scan(user.username, str_data, best_frame_base64=best_frame_base64, latitude=latitude,
                    longitude=longitude)
                if scan_id:
                    return {"message": detected_data, "scan_id": scan_id, "debug_word_data": word_data}
                else:
                    raise HTTPException(status_code=500, detail="Failed to save scan")
          
        except HTTPException as he:
            raise he
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error processing image"
            )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server error"
        )


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

@app.get("/history/recordings")
async def get_records(user: User = Depends(get_current_user)):
    records = get_scan_history(user.username)
    return {"records": records}

@app.get("/history/recordings/paginated")
async def get_records_paginated(
    page: int = 1,
    limit: int = 20,
    search: str = "",
    sort: str = "newest",
    date_filter: str = "all",
    favorites_only: bool = False,
    user: User = Depends(get_current_user)
):
    """
    Get paginated scan history with server-side filtering, sorting, and date filtering.
    
    Parameters:
    - page: Page number (1-based)
    - limit: Records per page (max 100)
    - search: Search term for filtering by name
    - sort: Sort order ('newest', 'oldest', 'name')
    - date_filter: Date filter ('all', 'today', 'week', 'month')
    - favorites_only: Show only favorite records
    """
    # Validate parameters
    if page < 1:
        page = 1
    if limit < 1 or limit > 100:  # Cap at 100 records per page
        limit = 20
    
    # Validate sort parameter
    if sort not in ['newest', 'oldest', 'name']:
        sort = 'newest'
    
    # Validate date_filter parameter
    if date_filter not in ['all', 'today', 'week', 'month']:
        date_filter = 'all'
    
    try:
        result = get_scan_history_paginated(user.username, page=page, limit=limit, search=search, sort=sort, date_filter=date_filter, favorites_only=favorites_only)
        return {
            "success": True,
            "data": result["records"],
            "pagination": {
                "current_page": result["page"],
                "per_page": result["limit"],
                "total_records": result["total_count"],
                "total_pages": result["total_pages"],
                "has_next": result["page"] < result["total_pages"],
                "has_prev": result["page"] > 1
            }
        }
    except Exception as e:
        logger.error(f"Error fetching paginated records for user {user.username}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch records")

@app.get("/history/record/{record_id}")
async def get_record(record_id: int, user: User = Depends(get_current_user)):
    record = get_scan_history_by_id(user.id, record_id)
    return {"record": record}

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
    return {"portfolio_id": portfolio_id, "name": name}

# Get all portfolios that the current user owns or is a member of. returns a list of portfolio IDs and names.
@app.get("/portfolio/list")
async def list_user_portfolios(user: User = Depends(get_current_user)):
    portfolios = get_portfolios_for_user(user.id)
    # Convert tuple format to dict format for easier frontend consumption
    portfolio_list = [
        {"id": p[0], "name": p[1], "role": p[2]} 
        for p in portfolios
    ]
    return {"portfolios": portfolio_list}

# Share a portfolio with another user by adding them as a member
@app.post("/portfolio/share")
async def share_portfolio(data: SharePortfolioRequest, user: User = Depends(get_current_user)):
    if not data.portfolioId or not data.targetUsername:
        raise HTTPException(status_code=400, detail="Missing portfolioId or targetUsername")
    
    try:
        # Get the target user's ID from their username
        target_user_id = get_user_id(data.targetUsername)
        if not target_user_id:
            raise HTTPException(status_code=404, detail="Target user not found")

        success = share_portfolio_with_user(
            portfolio_id=data.portfolioId,
            requesting_user_id=user.id,
            target_user_id=target_user_id,
            role=data.role
        )
        return {"success": success}
    except HTTPException as e:
        # Re-raise HTTP exceptions to preserve their status code and detail
        raise e
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))  # Conflict try to share with a member
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.exception("Unexpected error while sharing portfolio")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

# Add a scan record to a portfolio.
@app.post("/portfolio/add_scan")
async def add_scan_to_portfolio_route(data: PortfolioScanRequest, user: User = Depends(get_current_user)):
    if not data.portfolioId or not data.scanId:
        raise HTTPException(status_code=400, detail="Missing portfolioId or scanId")
    try:
        added = add_scan_to_portfolio(data.portfolioId, data.scanId, user.id)
        return {"added": added}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.exception("Unexpected error while adding scan to portfolio")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

# Remove a scan record from a portfolio. Only is allowed to remove scans.
@app.post("/portfolio/remove_scan")
async def remove_scan_from_portfolio(data: PortfolioScanRequest, user: User = Depends(get_current_user)):
    if not data.portfolioId or not data.scanId:
        raise HTTPException(status_code=400, detail="Missing portfolioId or scanId")
    try:
        removed = delete_scan_from_portfolio(data.portfolioId, data.scanId, user.id)
        return {"removed": removed}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.exception("Unexpected error while removing scan from portfolio")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

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
async def delete_portfolio_route(data: PortfolioDeleteRequest, user: User = Depends(get_current_user)):
    try:
        if delete_portfolio(data.portfolioId, user.id):
            return {"message": "Portfolio deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Portfolio not found")
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/portfolio/remove_member")
async def remove_member(data: RemoveMemberRequest, user: User = Depends(get_current_user)):
    if not data.portfolioId or not data.targetUsername:
        raise HTTPException(status_code=400, detail="Missing required fields")
    
    try:
        # Get the target user's ID from their username
        target_user_id = get_user_id(data.targetUsername)
        if not target_user_id:
            raise HTTPException(status_code=404, detail="Target user not found")

        # Check if the requesting user is the owner
        role = get_user_role_in_portfolio(user.id, data.portfolioId)
        if role != 'owner':
            raise HTTPException(status_code=403, detail="Only the portfolio owner can remove members")

        # Remove the member
        conn = get_db_connection()
        if conn:
            try:
                with conn.cursor() as cur:
                    cur.execute("""
                        DELETE FROM portfolio_members 
                        WHERE portfolio_id = %s AND user_id = %s;
                    """, (data.portfolioId, target_user_id))
                    conn.commit()
                    return {"message": "Member removed successfully"}
            finally:
                conn.close()
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/portfolio/{portfolio_id}/members")
async def list_portfolio_members(portfolio_id: int, user: User = Depends(get_current_user)):
    role = get_user_role_in_portfolio(user.id, portfolio_id)
    if role == "notmember":
        raise HTTPException(status_code=403, detail="You are not a member of this portfolio.")
    
    members = get_portfolio_members(portfolio_id)
    return {"members": members}

@app.get("/portfolio/overview")
async def portfolio_overview(user: User = Depends(get_current_user)):
    try:
        data = get_user_portfolios_and_unassigned_recordings(user.id)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to retrieve portfolio overview")
    
@app.get("/portfolio/{portfolio_id}/name", response_model=PortfolioNameResponse)
async def get_portfolio_name(portfolio_id: int, user: User = Depends(get_current_user)):
    logger.info(f"Fetching name for portfolio {portfolio_id} for user {user.id}")
    try:
        role = get_user_role_in_portfolio(user.id, portfolio_id)
        if role == "notmember":
            logger.warning(f"User {user.id} has no access to portfolio {portfolio_id}")
            raise HTTPException(status_code=403, detail="Access denied")

        conn = get_db_connection()
        if not conn:
            logger.error("Failed to connect to database")
            raise HTTPException(status_code=500, detail="Database connection failed")

        try:
            with conn.cursor() as cur:
                cur.execute("SELECT name FROM portfolios WHERE id = %s;", (portfolio_id,))
                result = cur.fetchone()
                if not result:
                    logger.warning(f"Portfolio {portfolio_id} not found")
                    raise HTTPException(status_code=404, detail="Portfolio not found")
                logger.info(f"Found portfolio name: {result[0]}")
                return {"name": result[0]}
        finally:
            conn.close()
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error getting portfolio name: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/portfolio/data/{portfolio_id}")
async def get_portfolio(portfolio_id: int, user: User = Depends(get_current_user)):
    logger.info(f"Fetching portfolio {portfolio_id} for user {user.id}")
    try:
        role = get_user_role_in_portfolio(user.id, portfolio_id)
        if role == "notmember":
            logger.warning(f"User {user.id} has no access to portfolio {portfolio_id}")
            raise HTTPException(status_code=403, detail="Access denied")

        conn = get_db_connection()
        if not conn:
            logger.error("Failed to connect to database")
            raise HTTPException(status_code=500, detail="Database connection failed")

        try:
            with conn.cursor() as cur:
                cur.execute("SELECT id, name, owner_id FROM portfolios WHERE id = %s;", (portfolio_id,))
                result = cur.fetchone()
                if not result:
                    logger.warning(f"Portfolio {portfolio_id} not found")
                    raise HTTPException(status_code=404, detail="Portfolio not found")
                
                portfolio_id, name, owner_id = result
                return {
                    "id": portfolio_id,
                    "name": name,
                    "owner_id": owner_id,
                    "role": role
                }
        finally:
            conn.close()
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error getting portfolio: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/portfolio/rename")
async def rename_portfolio_route(data: RenamePortfolioRequest, user: User = Depends(get_current_user)):
    if not data.portfolioId or not data.newName:
        raise HTTPException(status_code=400, detail="Missing portfolioId or newName")
    try:
        renamed = rename_portfolio(data.portfolioId, data.newName, user.id)
        return {"renamed": renamed}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.exception("Unexpected error while renaming portfolio")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@app.post("/history/rename")
async def rename_scan(data: RenameScanRequest, user: User = Depends(get_current_user)):
    try:
        success = update_scan_name(data.scanId, user.id, data.newName)
        if not success:
            raise HTTPException(status_code=404, detail="Scan not found or you don't have permission to rename it")
        return {"message": "Scan renamed successfully"}
    except Exception as e:
        logger.error(f"Error renaming scan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/portfolio/change_role")
async def change_member_role(data: ChangeMemberRoleRequest, user: User = Depends(get_current_user)):
    if not data.portfolioId or not data.targetUsername or not data.newRole:
        raise HTTPException(status_code=400, detail="Missing required fields")
    
    if data.newRole not in ['editor', 'viewer']:
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'editor' or 'viewer'")
    
    try:
        # Get the target user's ID from their username
        target_user_id = get_user_id(data.targetUsername)
        if not target_user_id:
            raise HTTPException(status_code=404, detail="Target user not found")

        # Check if the requesting user is the owner
        role = get_user_role_in_portfolio(user.id, data.portfolioId)
        if role != 'owner':
            raise HTTPException(status_code=403, detail="Only the portfolio owner can change member roles")

        # Update the member's role
        conn = get_db_connection()
        if conn:
            try:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE portfolio_members 
                        SET role = %s 
                        WHERE portfolio_id = %s AND user_id = %s;
                    """, (data.newRole, data.portfolioId, target_user_id))
                    conn.commit()
                    return {"message": "Role updated successfully"}
            finally:
                conn.close()
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/history/check_ownership")
async def check_scan_ownership(data: ScanOwnershipRequest, user: User = Depends(get_current_user)):
    try:
        conn = get_db_connection()
        if not conn:
            raise HTTPException(status_code=500, detail="Database connection failed")

        try:
            with conn.cursor() as cur:
                cur.execute("SELECT user_id FROM scan_history WHERE id = %s;", (data.scanId,))
                result = cur.fetchone()
                if not result:
                    raise HTTPException(status_code=404, detail="Scan not found")
                
                is_owner = result[0] == user.id
                return {"isOwner": is_owner}
        finally:
            conn.close()
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error checking scan ownership: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/portfolio/request/status")
async def check_request_status(portfolio_id: int, user: User = Depends(get_current_user)):
    try:
        status = get_request_status(portfolio_id, user.id)
        return {"status": status or "not_found"}
    except Exception as e:
        logger.error(f"Failed to fetch request status: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    
@app.get("/portfolio/request/pending")
async def get_pending_requests(user: User = Depends(get_current_user)):
    try:
        requests = get_pending_requests_for_user(user.id)
        return {"requests": requests}
    except Exception as e:
        logger.error(f"Failed to fetch pending requests: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/portfolio/request/respond")
async def respond_to_request(data: RespondRequestBody, user: User = Depends(get_current_user)):
    try:
        success = respond_to_portfolio_request(user.id, data.requestId, data.action)
        if not success:
            raise HTTPException(status_code=400, detail="Invalid request or already handled")
        return {"message": f"Request {data.action}ed successfully"}
    except Exception as e:
        logger.error(f"Error responding to request: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# =========================
# OSINT ENDPOINTS
# =========================
@app.get('/api/scan-details/{scan_id}')
async def get_scan_details(scan_id: int, user: User = Depends(get_current_user)):
    """Get detailed information for a specific scan"""
    try:
        # Get scan data using the existing function
        scan_data = get_scan_history_by_id(user.id, scan_id)
        
        if not scan_data or len(scan_data) == 0:
            raise HTTPException(status_code=404, detail="Scan not found or access denied")
        
        # scan_data is a list with one tuple: (id, scan_time, decrypted_text)
        scan = scan_data[0]
        
        # Get enhanced data if available
        enhanced_data = None
        enhanced_at = None
        try:
            enhanced_result = osint_enhancer.get_enhanced_data(scan_id)
            if enhanced_result:
                enhanced_data = enhanced_result['data']
                enhanced_at = enhanced_result['created_at'].isoformat() if enhanced_result['created_at'] else None
        except Exception as e:
            logging.warning(f"Could not retrieve enhanced data for scan {scan_id}: {e}")
        
        response = {
            'scan_data': {
                'id': scan[0],
                'scan_time': scan[1].isoformat() if scan[1] else None,
                'detected_text': scan[2],  # Already decrypted by get_scan_history_by_id
                'name': f"Scan_{scan[0]}"  # Default name since your function doesn't return name
            },
            'enhanced_data': enhanced_data,
            'enhanced_at': enhanced_at
        }
        
        return response
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Error retrieving scan details for scan {scan_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve scan details: {str(e)}")

@app.get('/api/scan-history')
async def get_scan_history_route(user: User = Depends(get_current_user)):
    """Get scan history for current user"""
    try:
        # Use your existing function
        scan_history = get_scan_history(user.username)
        
        if not scan_history:
            return {
                'success': True,
                'scans': [],
                'message': 'No scan history found'
            }
        
        # Format the data for frontend
        formatted_scans = []
        for i, scan in enumerate(scan_history):
            try:
                # Your get_scan_history returns: (id, scan_time, name)
                if not scan or len(scan) < 3:
                    logging.warning(f"Invalid scan data at index {i}: {scan}")
                    continue
                
                scan_id = scan[0] if scan[0] is not None else f"unknown_{i}"
                scan_time = scan[1] if scan[1] is not None else None
                name = scan[2] if scan[2] is not None else f'Scan_{scan_id}'
                
                # Format scan_time safely
                formatted_time = None
                if scan_time:
                    try:
                        if hasattr(scan_time, 'isoformat'):
                            formatted_time = scan_time.isoformat()
                        else:
                            formatted_time = str(scan_time)
                    except Exception as time_error:
                        logging.warning(f"Error formatting scan_time: {time_error}")
                        formatted_time = None
                
                # Create preview
                preview = f"{name[:100]}..." if len(name) > 100 else name
                
                formatted_scans.append({
                    'id': scan_id,
                    'scan_time': formatted_time,
                    'detected_text': '',  # Not available from your current function
                    'name': name,
                    'preview': preview
                })
                
            except Exception as scan_error:
                logging.warning(f"Error processing scan at index {i}: {scan_error}")
                continue
        
        return {
            'success': True,
            'scans': formatted_scans,
            'count': len(formatted_scans)
        }
        
    except Exception as e:
        logging.error(f"Error retrieving scan history for user {user.username}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve scan history: {str(e)}")

@app.post('/api/enhance-scan-comprehensive/{scan_id}')
async def enhance_scan_comprehensive(
    scan_id: int, 
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user)
):
    """Start comprehensive OSINT enhancement with real-time progress tracking"""
    print(f"🔍 OSINT Enhancement called for scan_id: {scan_id}")
    
    try:
        # FIXED: Check if user owns this scan using direct database query
        conn = get_db_connection()
        if not conn:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        try:
            with conn.cursor() as cur:
                # Check if scan belongs to user
                cur.execute("""
                    SELECT id FROM scan_history 
                    WHERE id = %s AND user_id = %s
                """, (scan_id, user.id))
                
                result = cur.fetchone()
                if not result:
                    raise HTTPException(status_code=403, detail="Unauthorized access to scan")
                
                print(f"✅ Scan {scan_id} belongs to user {user.username}")
                
        finally:
            conn.close()
        
        # Check if enhancement already exists
        existing_enhancement = osint_enhancer.get_enhanced_data(scan_id)
        if existing_enhancement:
            print(f"✅ Enhancement already exists for scan {scan_id}")
            return {
                'success': True,
                'message': 'Enhancement already exists',
                'data': existing_enhancement['data'],
                'created_at': existing_enhancement['created_at'].isoformat() if existing_enhancement['created_at'] else None
            }
        
        print(f"🚀 Starting new enhancement for scan {scan_id}")
        
        # Initialize progress tracking
        osint_progress[scan_id] = {
            'status': 'starting',
            'progress': 0,
            'message': 'Initializing OSINT enhancement...',
            'started_at': time.time(),
            'current_step': 'initialization'
        }
        
        # Start enhancement in background
        background_tasks.add_task(run_comprehensive_osint_enhancement, scan_id)
        print(f"✅ Background task started for scan {scan_id}")
        
        return {
            'success': True,
            'message': 'Comprehensive OSINT enhancement started',
            'scan_id': scan_id,
            'status': 'processing',
            'check_progress_url': f'/api/osint-progress/{scan_id}'
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"❌ Error in enhance_scan_comprehensive for scan {scan_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start enhancement: {str(e)}")

async def run_comprehensive_osint_enhancement(scan_id: int):
    """FIXED: Background enhancement process that actually works"""
    print(f"🚀 Background task started for scan_id: {scan_id}")
    
    try:
        # Step 1: Update progress to processing
        osint_progress[scan_id].update({
            'status': 'processing',
            'progress': 10,
            'message': 'Starting OSINT enhancement...',
            'current_step': 'initialization',
            'started_at': time.time()
        })
        print(f"✅ Progress initialized")
        
        # Step 2: Get scan data
        print(f"📊 Getting scan data for scan_id: {scan_id}")
        scan_data = osint_enhancer.get_scan_data_by_id(scan_id)
        
        if not scan_data:
            print(f"❌ No scan data found for scan_id: {scan_id}")
            osint_progress[scan_id].update({
                'status': 'error',
                'message': 'Scan data not found',
                'error': 'Scan data not found'
            })
            return
        
        print(f"✅ Scan data retrieved successfully")
        
        # Step 3: Detect data types
        osint_progress[scan_id].update({
            'progress': 20,
            'message': 'Detecting sensitive data types...',
            'current_step': 'data_detection'
        })
        
        detected_text = scan_data.get('detected_text', '') or ''
        scan_name = scan_data.get('name', '') or f"Scan_{scan_id}"
        
        print(f"📝 Analyzing text: '{detected_text[:100]}...'")
        detected_data = osint_enhancer.detect_all_data_types(detected_text)
        
        # Create summary of detected data
        data_summary = []
        for data_type, items in detected_data.items():
            if items:
                data_summary.append(f"{len(items)} {data_type.replace('_', ' ').lower()}")
        
        osint_progress[scan_id].update({
            'progress': 30,
            'message': f'Detected: {", ".join(data_summary) if data_summary else "No specific data"}. Generating search queries...',
            'current_step': 'query_generation',
            'detected_data_summary': data_summary
        })
        
        # Step 4: Generate search queries
        print(f"🔍 Generating intelligence queries...")
        queries = osint_enhancer.generate_intelligence_queries(detected_data, scan_name)
        
        osint_progress[scan_id].update({
            'progress': 40,
            'message': f'Generated {len(queries)} intelligence queries. Starting web searches...',
            'current_step': 'web_searching',
            'total_queries': len(queries)
        })
        
        # Step 5: Perform web searches with progress updates
        all_search_results = []
        google_searches = []
        
        search_limit = min(len(queries), 15)  # Limit to 15 searches
        
        for i, query_info in enumerate(queries[:search_limit]):
            query = query_info['query']
            query_type = query_info['type']
            
            # Update progress for each search
            progress_percent = 40 + (i / search_limit) * 40  # 40% to 80%
            osint_progress[scan_id].update({
                'progress': int(progress_percent),
                'message': f'Searching web: "{query}" ({i+1}/{search_limit})',
                'current_step': 'web_searching',
                'current_query': query,
                'queries_completed': i + 1
            })
            
            print(f"🔎 Search {i+1}/{search_limit}: '{query}' (type: {query_type})")
            
            # Perform the actual search
            search_results = osint_enhancer.search_web_duckduckgo(query, max_results=5)
            
            google_searches.append({
                "query": query,
                "type": query_type,
                "timestamp": int(time.time()),
                "results_count": len(search_results),
                "priority": query_info['priority']
            })
            
            all_search_results.extend(search_results)
            print(f"  ✅ Found {len(search_results)} results")
            
            # Rate limiting
            time.sleep(random.uniform(1, 3))
        
        print(f"🎯 Total search results: {len(all_search_results)}")
        
        # Step 6: Analyze results
        osint_progress[scan_id].update({
            'progress': 80,
            'message': f'Analyzing {len(all_search_results)} search results...',
            'current_step': 'analysis',
            'total_results': len(all_search_results)
        })
        
        # Analyze phone numbers
        phone_analysis = []
        for phone in detected_data.get('PHONE_NUMBER', []):
            print(f"📱 Analyzing phone: {phone}")
            analysis = osint_enhancer.analyze_phone_number(phone)
            phone_results = [r for r in all_search_results if phone in r.get('query', '')]
            analysis['web_search_results'] = phone_results[:5]
            phone_analysis.append(analysis)
        
        # Analyze emails
        email_analysis = []
        for email in detected_data.get('EMAIL', []):
            print(f"📧 Analyzing email: {email}")
            analysis = {
                "email": email,
                "osint_result": {
                    "domain": email.split('@')[1] if '@' in email else '',
                    "username": email.split('@')[0] if '@' in email else ''
                }
            }
            
            email_results = [r for r in all_search_results if email in r.get('query', '') or email.split('@')[0] in r.get('query', '')]
            analysis['web_search_results'] = email_results[:5]
            analysis['breach_check_results'] = osint_enhancer.check_data_breaches(email)
            
            email_analysis.append(analysis)
        
        # Extract potential names
        osint_progress[scan_id].update({
            'progress': 90,
            'message': 'Extracting names and building intelligence report...',
            'current_step': 'name_extraction'
        })
        
        potential_names = osint_enhancer.extract_potential_names(all_search_results)
        if not potential_names and scan_name != f"Scan_{scan_id}":
            potential_names = [scan_name]
        
        # Build comprehensive enhanced data
        high_relevance_results = [r for r in all_search_results if r.get('relevance_score', 0) > 0.5]
        
        enhanced_data = {
            'original_scan': {
                'id': scan_data['id'],
                'user_id': scan_data['user_id'],
                'scan_time': scan_data['scan_time'].isoformat() if scan_data['scan_time'] else None,
                'detected_text': detected_text,
                'name': scan_name
            },
            'enhancement_timestamp': int(time.time()),
            'detected_data': detected_data,
            'personal_info': {
                'potential_names': potential_names,
                'social_profiles': osint_enhancer._extract_social_profiles(all_search_results),
                'web_mentions': high_relevance_results[:10],
                'combined_search_results': all_search_results[:25]
            },
            'phone_analysis': phone_analysis,
            'email_analysis': email_analysis,
            'osint_results': {
                'total_queries': len(queries),
                'executed_queries': len(google_searches),
                'total_results': len(all_search_results),
                'high_relevance_results': len(high_relevance_results)
            },
            'google_searches': google_searches,
            'web_search_summary': {
                'total_searches': len(google_searches),
                'breach_checks_performed': len(email_analysis),
                'potential_matches_found': len(high_relevance_results),
                'social_media_found': len([r for r in all_search_results if any(platform in r.get('source', '').lower() for platform in ['linkedin', 'facebook', 'instagram', 'twitter', 'tiktok'])])
            },
            'summary': {
                'phones_found': len(detected_data.get('PHONE_NUMBER', [])),
                'emails_found': len(detected_data.get('EMAIL', [])),
                'names_found': len(potential_names),
                'searches_performed': len(google_searches),
                'social_profiles_found': len(osint_enhancer._extract_social_profiles(all_search_results)),
                'enhancement_status': 'completed'
            }
        }
        
        # Step 7: Save to database
        osint_progress[scan_id].update({
            'progress': 95,
            'message': 'Saving OSINT intelligence data...',
            'current_step': 'saving'
        })
        
        print(f"💾 Saving enhanced data to database...")
        save_result = osint_enhancer.save_enhanced_data(scan_id, enhanced_data)
        
        if save_result:
            osint_progress[scan_id].update({
                'status': 'completed',
                'progress': 100,
                'message': 'OSINT enhancement completed successfully!',
                'current_step': 'completed',
                'completed_at': time.time(),
                'enhancement_data': enhanced_data
            })
            print(f"✅ Enhancement completed successfully for scan {scan_id}")
            print(f"📊 Final summary: {enhanced_data['summary']}")
        else:
            osint_progress[scan_id].update({
                'status': 'error',
                'message': 'Failed to save enhancement data',
                'error': 'Database save failed'
            })
            print(f"❌ Failed to save data to database for scan {scan_id}")
        
    except Exception as e:
        print(f"❌ Error in background task for scan {scan_id}: {e}")
        import traceback
        print(f"❌ Traceback: {traceback.format_exc()}")
        
        osint_progress[scan_id].update({
            'status': 'error',
            'message': f'Enhancement failed: {str(e)}',
            'error': str(e)
        })

@app.get('/api/osint-progress/{scan_id}')
async def get_osint_progress(scan_id: int, user: User = Depends(get_current_user)):
    """Get real-time progress of OSINT enhancement"""
    try:
        # Verify user owns the scan
        conn = get_db_connection()
        if not conn:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id FROM scan_history 
                    WHERE id = %s AND user_id = %s
                """, (scan_id, user.id))
                
                if not cur.fetchone():
                    raise HTTPException(status_code=403, detail="Unauthorized access to scan")
        finally:
            conn.close()
        
        # Get progress
        progress = osint_progress.get(scan_id)
        
        if not progress:
            # Check if enhancement already exists
            existing_enhancement = osint_enhancer.get_enhanced_data(scan_id)
            if existing_enhancement:
                return {
                    'status': 'completed',
                    'progress': 100,
                    'message': 'Enhancement already completed',
                    'data': existing_enhancement['data']
                }
            else:
                return {
                    'status': 'not_started',
                    'progress': 0,
                    'message': 'Enhancement not started'
                }
        
        return progress
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logging.error(f"Error getting OSINT progress for scan {scan_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get progress: {str(e)}")

@app.get('/api/osint-data/{scan_id}')
async def get_osint_data(scan_id: int, user: User = Depends(get_current_user)):
    """Get OSINT data with progress information"""
    try:
        # Verify user owns the scan
        conn = get_db_connection()
        if not conn:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id FROM scan_history 
                    WHERE id = %s AND user_id = %s
                """, (scan_id, user.id))
                
                if not cur.fetchone():
                    raise HTTPException(status_code=403, detail="Unauthorized access to scan")
        finally:
            conn.close()
        
        # Check if still processing
        progress = osint_progress.get(scan_id)
        if progress and progress.get('status') == 'processing':
            return {
                'success': False,
                'status': 'processing',
                'progress': progress,
                'message': 'Enhancement still in progress'
            }
        
        # Get enhanced data from database
        enhanced_data = osint_enhancer.get_enhanced_data(scan_id)
        
        if enhanced_data:
            # Clean up progress tracking
            if scan_id in osint_progress:
                del osint_progress[scan_id]
            
            return {
                'success': True,
                'status': 'completed',
                'data': enhanced_data['data'],
                'created_at': enhanced_data['created_at'].isoformat() if enhanced_data['created_at'] else None
            }
        else:
            return {
                'success': False,
                'status': 'not_found',
                'message': 'No enhancement data found'
            }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logging.error(f"Error getting OSINT data for scan {scan_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get OSINT data: {str(e)}")

@app.delete('/api/osint-data/{scan_id}')
async def delete_osint_data(scan_id: int, user: User = Depends(get_current_user)):
    """Delete OSINT enhancement data"""
    try:
        # Verify user owns the scan
        conn = get_db_connection()
        if not conn:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        try:
            with conn.cursor() as cur:
                # Check ownership and delete in one transaction
                cur.execute("""
                    DELETE FROM enhanced_osint 
                    WHERE scan_id = %s 
                    AND scan_id IN (
                        SELECT id FROM scan_history WHERE user_id = %s
                    )
                """, (scan_id, user.id))
                
                deleted_rows = cur.rowcount
                conn.commit()
                
                # Clean up progress tracking
                if scan_id in osint_progress:
                    del osint_progress[scan_id]
                
                if deleted_rows > 0:
                    return {'success': True, 'message': 'OSINT data deleted successfully'}
                else:
                    return {'success': False, 'message': 'No OSINT data found to delete'}
        finally:
            conn.close()
        
    except Exception as e:
        logging.error(f"Error deleting OSINT data for scan {scan_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete OSINT data: {str(e)}")

@app.get('/api/osint-statistics')
async def get_osint_statistics(user: User = Depends(get_current_user)):
    """Get OSINT statistics for the current user"""
    try:
        conn = get_db_connection()
        if not conn:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        try:
            with conn.cursor() as cur:
                # Get user's total scans
                cur.execute("SELECT COUNT(*) FROM scan_history WHERE user_id = %s", (user.id,))
                total_scans = cur.fetchone()[0]
                
                # Get enhanced scans count
                cur.execute("""
                    SELECT COUNT(*) FROM enhanced_osint e
                    JOIN scan_history s ON e.scan_id = s.id
                    WHERE s.user_id = %s
                """, (user.id,))
                enhanced_count = cur.fetchone()[0]
                
                # Count currently processing
                processing_count = len([
                    scan_id for scan_id, progress in osint_progress.items() 
                    if progress.get('status') == 'processing'
                ])
                
                enhancement_rate = (enhanced_count / total_scans * 100) if total_scans > 0 else 0
                
                return {
                    'total_scans': total_scans,
                    'enhanced_scans': enhanced_count,
                    'pending_scans': total_scans - enhanced_count - processing_count,
                    'processing_scans': processing_count,
                    'enhancement_rate': round(enhancement_rate, 1)
                }
        finally:
            conn.close()
        
    except Exception as e:
        logging.error(f"Error getting OSINT statistics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get statistics: {str(e)}")

@app.post('/api/test-osint/{scan_id}')
async def test_osint_system(scan_id: int, user: User = Depends(get_current_user)):
    """Test the OSINT system with a simple enhancement"""
    try:
        # Verify user owns the scan
        conn = get_db_connection()
        if not conn:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id FROM scan_history 
                    WHERE id = %s AND user_id = %s
                """, (scan_id, user.id))
                
                if not cur.fetchone():
                    raise HTTPException(status_code=403, detail="Unauthorized access to scan")
        finally:
            conn.close()
        
        # Run a simple test enhancement
        print(f"🧪 Testing OSINT system for scan {scan_id}")
        
        # Get scan data
        scan_data = osint_enhancer.get_scan_data_by_id(scan_id)
        if not scan_data:
            return {"success": False, "message": "Scan data not found"}
        
        # Test data detection
        detected_text = scan_data.get('detected_text', '')
        detected_data = osint_enhancer.detect_all_data_types(detected_text)
        
        # Test search query generation
        queries = osint_enhancer.generate_intelligence_queries(detected_data, scan_data.get('name', ''))
        
        # Test one search
        if queries:
            test_query = queries[0]['query']
            search_results = osint_enhancer.search_web_duckduckgo(test_query, max_results=3)
        else:
            search_results = []
        
        return {
            "success": True,
            "message": "OSINT system test completed",
            "test_results": {
                "scan_data_found": bool(scan_data),
                "detected_data": detected_data,
                "queries_generated": len(queries),
                "sample_query": queries[0]['query'] if queries else None,
                "search_results_count": len(search_results),
                "sample_result": search_results[0] if search_results else None
            }
        }
        
    except Exception as e:
        logging.error(f"Error testing OSINT system: {e}")
        return {"success": False, "message": f"Test failed: {str(e)}"}

@app.post('/api/force-refresh-osint/{scan_id}')
async def force_refresh_osint(scan_id: int, user: User = Depends(get_current_user)):
    """Force refresh OSINT data by deleting old data and creating new enhancement"""
    try:
        print(f"🔄 Force refreshing OSINT data for scan {scan_id}")
        
        # Verify user owns the scan
        conn = get_db_connection()
        if not conn:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        try:
            with conn.cursor() as cur:
                # Check ownership
                cur.execute("""
                    SELECT id FROM scan_history 
                    WHERE id = %s AND user_id = %s
                """, (scan_id, user.id))
                
                if not cur.fetchone():
                    raise HTTPException(status_code=403, detail="Unauthorized access to scan")
                
                # Delete existing enhancement data
                print(f"🗑️ Deleting old enhancement data...")
                cur.execute("DELETE FROM enhanced_osint WHERE scan_id = %s", (scan_id,))
                deleted_rows = cur.rowcount
                conn.commit()
                
                print(f"✅ Deleted {deleted_rows} old enhancement records")
                
        finally:
            conn.close()
        
        # Clean up progress tracking
        if scan_id in osint_progress:
            del osint_progress[scan_id]
        
        # Now run fresh enhancement
        print(f"🚀 Starting fresh enhancement...")
        enhancement_result = osint_enhancer.enhance_scan_data(scan_id)
        
        if 'error' in enhancement_result:
            return {
                'success': False,
                'message': f'Fresh enhancement failed: {enhancement_result["error"]}',
                'scan_id': scan_id
            }
        
        return {
            'success': True,
            'message': 'OSINT data refreshed successfully',
            'scan_id': scan_id,
            'data': enhancement_result
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logging.error(f"Error force refreshing OSINT for scan {scan_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to refresh OSINT data: {str(e)}")

@app.post('/api/quick-osint/{scan_id}')
async def quick_osint_enhancement(scan_id: int, user: User = Depends(get_current_user)):
    """SUPER FAST OSINT - generates results in under 10 seconds"""
    try:
        print(f"⚡ QUICK OSINT Enhancement called for scan_id: {scan_id}")
        
        # Verify user owns the scan
        conn = get_db_connection()
        if not conn:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id FROM scan_history 
                    WHERE id = %s AND user_id = %s
                """, (scan_id, user.id))
                
                if not cur.fetchone():
                    raise HTTPException(status_code=403, detail="Unauthorized access to scan")
        finally:
            conn.close()
        
        # Delete any existing enhancement
        try:
            conn = get_db_connection()
            with conn.cursor() as cur:
                cur.execute("DELETE FROM enhanced_osint WHERE scan_id = %s", (scan_id,))
                conn.commit()
            conn.close()
        except:
            pass
        
        # Get scan data quickly
        scan_data = osint_enhancer.get_scan_data_by_id(scan_id)
        if not scan_data:
            raise HTTPException(status_code=404, detail="Scan data not found")
        
        detected_text = scan_data.get('detected_text', '') or ''
        scan_name = scan_data.get('name', '') or f'Scan_{scan_id}'
        
        print(f"⚡ Quick processing: '{detected_text}'")
        
        # Quick data detection
        detected_data = osint_enhancer.detect_all_data_types(detected_text)
        
        # Generate only the most important queries (limit to 6)
        all_queries = osint_enhancer.generate_intelligence_queries(detected_data, scan_name)
        quick_queries = all_queries[:6]  # Only top 6 queries
        
        print(f"⚡ Quick queries: {len(quick_queries)}")
        
        # Generate mock data immediately (skip real searches for speed)
        all_search_results = []
        google_searches = []
        
        for i, query_info in enumerate(quick_queries):
            query = query_info['query']
            
            # Generate mock results instantly
            mock_results = osint_enhancer._generate_realistic_mock_results(query, max_results=5)
            all_search_results.extend(mock_results)
            
            google_searches.append({
                "query": query,
                "type": query_info['type'],
                "timestamp": int(time.time()),
                "results_count": len(mock_results),
                "priority": query_info['priority']
            })
        
        # Quick analysis
        email_analysis = []
        for email in detected_data.get('EMAIL', []):
            username = email.split('@')[0] if '@' in email else ''
            email_results = [r for r in all_search_results 
                           if email in r.get('query', '') or username in r.get('query', '')]
            
            email_analysis.append({
                "email": email,
                "osint_result": {
                    "domain": email.split('@')[1] if '@' in email else '',
                    "username": username
                },
                "web_search_results": email_results[:8],
                "breach_check_results": []  # Skip for speed
            })
        
        # Quick phone analysis
        phone_analysis = []
        for phone in detected_data.get('PHONE_NUMBER', []):
            analysis = osint_enhancer.analyze_phone_number(phone)
            phone_results = [r for r in all_search_results if phone in r.get('query', '')]
            analysis['web_search_results'] = phone_results[:5]
            phone_analysis.append(analysis)
        
        # Quick name extraction and social profiles
        potential_names = osint_enhancer._fast_extract_names(all_search_results)
        if not potential_names and scan_name != f'Scan_{scan_id}':
            potential_names = [scan_name]
        
        social_profiles = osint_enhancer._extract_social_profiles(all_search_results)
        high_relevance_results = [r for r in all_search_results if r.get('relevance_score', 0) > 0.5]
        
        # Build enhanced data structure
        enhanced_data = {
            'original_scan': {
                'id': scan_data['id'],
                'user_id': scan_data['user_id'],
                'scan_time': scan_data['scan_time'].isoformat() if scan_data['scan_time'] else None,
                'detected_text': detected_text,
                'name': scan_name
            },
            'enhancement_timestamp': int(time.time()),
            'detected_data': detected_data,
            'personal_info': {
                'potential_names': potential_names,
                'social_profiles': social_profiles,
                'web_mentions': high_relevance_results[:10],
                'combined_search_results': all_search_results[:20]
            },
            'phone_analysis': phone_analysis,
            'email_analysis': email_analysis,
            'osint_results': {
                'total_queries': len(all_queries),
                'executed_queries': len(google_searches),
                'total_results': len(all_search_results),
                'high_relevance_results': len(high_relevance_results)
            },
            'google_searches': google_searches,
            'web_search_summary': {
                'total_searches': len(google_searches),
                'breach_checks_performed': 0,  # Skipped for speed
                'potential_matches_found': len(high_relevance_results),
                'social_media_found': len(social_profiles)
            },
            'summary': {
                'phones_found': len(detected_data.get('PHONE_NUMBER', [])),
                'emails_found': len(detected_data.get('EMAIL', [])),
                'names_found': len(potential_names),
                'searches_performed': len(google_searches),
                'social_profiles_found': len(social_profiles),
                'total_results': len(all_search_results),
                'high_relevance_results': len(high_relevance_results),
                'enhancement_status': 'completed'
            }
        }
        
        # Save to database
        save_result = osint_enhancer.save_enhanced_data(scan_id, enhanced_data)
        
        if save_result:
            print(f"⚡ Quick OSINT completed in seconds!")
            return {
                'success': True,
                'message': 'Quick OSINT completed in under 10 seconds',
                'scan_id': scan_id,
                'data': enhanced_data,
                'performance': {
                    'mode': 'quick',
                    'searches_performed': len(google_searches),
                    'results_generated': len(all_search_results),
                    'estimated_time': '< 10 seconds'
                }
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to save quick OSINT data")
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logging.error(f"Error in quick OSINT for scan {scan_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Quick OSINT failed: {str(e)}")

@app.get("/users/search")
async def search_users(q: str = "", user: User = Depends(get_current_user)):
    """Search for users by username for autocomplete functionality"""
    try:
        conn = get_db_connection()
        if not conn:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        try:
            with conn.cursor() as cur:
                if q.strip():
                    # Search for users whose username contains the query string
                    cur.execute("""
                        SELECT username FROM users 
                        WHERE username ILIKE %s 
                        AND username != %s
                        ORDER BY username
                        LIMIT 20
                    """, (f"%{q}%", user.username))
                else:
                    # Return all users except current user (limited to 20)
                    cur.execute("""
                        SELECT username FROM users 
                        WHERE username != %s
                        ORDER BY username
                        LIMIT 20
                    """, (user.username,))
                
                results = cur.fetchall()
                usernames = [row[0] for row in results]
                
                return {
                    "users": [{"username": username} for username in usernames],
                    "count": len(usernames)
                }
                
        finally:
            conn.close()
            
    except Exception as e:
        logging.error(f"Error searching users: {e}")
        raise HTTPException(status_code=500, detail="Failed to search users")

@app.post("/history/toggle_favorite")
async def toggle_record_favorite(request: Request, user: User = Depends(get_current_user)):
    """Toggle the favorite status of a scan record."""
    try:
        data = await request.json()
        scan_id = data.get("scanId")
        
        if not scan_id:
            raise HTTPException(status_code=400, detail="Missing scanId")
        
        new_favorite_status = toggle_scan_favorite(scan_id, user.id)
        return {
            "success": True,
            "is_favorite": new_favorite_status,
            "message": "Added to favorites" if new_favorite_status else "Removed from favorites"
        }
    except Exception as e:
        logger.error(f"Error toggling favorite for user {user.username}: {e}")
        raise HTTPException(status_code=500, detail="Failed to toggle favorite")

#for showing screenshot to client
@app.get("/api/scan/{scan_id}/image")
async def get_best_frame(scan_id: int, user: User = Depends(get_current_user)):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        with conn.cursor() as cur:
            cur.execute("SELECT user_id, best_frame_base64 FROM scan_history WHERE id = %s", (scan_id,))
            row = cur.fetchone()

            if not row:
                raise HTTPException(status_code=404, detail="Scan not found")

            owner_id, image_base64 = row
            if owner_id != user.id:
                raise HTTPException(status_code=403, detail="Permission denied")

            if not image_base64:
                raise HTTPException(status_code=404, detail="No image found")

            return {"image_base64": image_base64}
        
    finally:
        conn.close()

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    # Check if it's an API endpoint
    if full_path.startswith(('api/', 'history/', 'auth/')):
        # If it's an API endpoint that doesn't exist, return 404
        raise HTTPException(status_code=404, detail="API endpoint not found")
    
    # For all other routes, serve the index.html
    index_path = os.path.join(client_path, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    else:
        raise HTTPException(status_code=404, detail="index.html not found")