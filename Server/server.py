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
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
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
ensure_scan_history_columns()  # Ensure scan_history has all required columns

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
            cropped_image = get_phones_from_cords(frame, find_largest_phone_from_cords(cord_cropped_image))
            if len(cropped_image) > 0:
                cropped_image = cropped_image[0]
            else:
                raise HTTPException(status_code=201, detail="No phone found.")
            enhanced_image = enhance_image(cropped_image)
            extracted_text = ocr_manager.extract_text(enhanced_image)
            detected_data = classify_text(extracted_text[0])
            str_data = convert_to_formatted_string(detected_data) 

            if detected_data:
                insert_scan(user.username, str_data)
                return {"message": detected_data}
            else:
                raise HTTPException(status_code=202, detail="No data found.")
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

@app.get("/history/recordings")
async def get_records(user: User = Depends(get_current_user)):
    records = get_scan_history(user.username)
    return {"records": records}

@app.get("/history/record/{record_id}")
async def get_record(record_id: int, user: User = Depends(get_current_user)):
    record = get_scan_history_by_id(user.id, record_id)
    return {"record": record}

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
    return {"portfolio_id": portfolio_id, "name": name}

# Get all portfolios that the current user owns or is a member of. returns a list of portfolio IDs and names.
@app.get("/portfolio/list")
async def list_user_portfolios(user: User = Depends(get_current_user)):
    portfolios = get_portfolios_for_user(user.id)
    return {"portfolios": portfolios}

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