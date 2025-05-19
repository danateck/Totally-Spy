import os
import psycopg2
import bcrypt
from dotenv import load_dotenv
from cryptography.fernet import Fernet
import binascii
from fastapi import HTTPException
import logging
from typing import Optional
from datetime import datetime

from pydantic import BaseModel

# Load environment variables from .env file
load_dotenv("./env/.env")

# PostgreSQL connection details
DB_CONFIG = {
    "dbname": os.getenv("DB_NAME"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "host": os.getenv("DB_HOST"),
    "port": os.getenv("DB_PORT"),
}

logger = logging.getLogger(__name__)  # Create a logger for notifications

class User(BaseModel):
    id: int
    username: str
    

# Connect to PostgreSQL
def get_db_connection():
    try:
        return psycopg2.connect(**DB_CONFIG)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")
    
#MASTER_KEY encrypts each user_key that is stored in db  
MASTER_KEY = os.getenv("MASTER_KEY")
if not MASTER_KEY:
    raise HTTPException(status_code=500, detail="Master key is not set in environment variables")

#user key is used to encrypt the scan results
def encrypt_user_key(user_key: bytes) -> bytes:
    cipher = Fernet(MASTER_KEY)
    return cipher.encrypt(user_key)

def decrypt_user_key(encrypted_key: bytes) -> bytes:
    cipher = Fernet(MASTER_KEY)
    return cipher.decrypt(encrypted_key)

# Function to create the users table -- exists
def create_users_table():
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        username TEXT UNIQUE NOT NULL,
                        password TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        encryption_key BYTEA
                    );
                """)
                conn.commit()
        except Exception as e:
            logger.error(f"Error creating table: {e}")
        finally:
            conn.close()

# Function to create the scan_history table -- exists
def create_scan_history_table():
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS scan_history (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        scan_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        detected_text TEXT NOT NULL,
                        name TEXT
                    );
                """)
                conn.commit()
                # Ensure all columns exist
                ensure_scan_history_columns()
        except Exception as e:
            logger.error(f"Error creating table: {e}")
        finally:
            conn.close()

# Function to create Portfolio-related tables
def create_portfolio_tables():
    """Create the portfolios, portfolio_scans, and portfolio_members tables."""
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS portfolios (
                        id SERIAL PRIMARY KEY,
                        name TEXT NOT NULL,
                        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS portfolio_scans (
                        id SERIAL PRIMARY KEY,
                        portfolio_id INTEGER REFERENCES portfolios(id) ON DELETE CASCADE,
                        scan_id INTEGER REFERENCES scan_history(id) ON DELETE CASCADE,
                        added_by_user_id INTEGER REFERENCES users(id),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS portfolio_members (
                        id SERIAL PRIMARY KEY,
                        portfolio_id INTEGER REFERENCES portfolios(id) ON DELETE CASCADE,
                        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        role TEXT CHECK (role IN ('owner', 'editor', 'viewer')) DEFAULT 'editor',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                conn.commit()
                logger.info("Portfolio-related tables created successfully.")
        except Exception as e:
            logger.error(f"Error creating portfolio tables: {e}")
        finally:
            conn.close()

# Creates a new portfolio if user wants
def add_portfolio(name: str, owner_id: int) -> Optional[int]:
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO portfolios (name, owner_id) VALUES (%s, %s) RETURNING id;",
                    (name, owner_id)
                )
                portfolio_id = cur.fetchone()[0]
                cur.execute(
                    "INSERT INTO portfolio_members (portfolio_id, user_id, role) VALUES (%s, %s, 'owner');",
                    (portfolio_id, owner_id)
                )
                conn.commit()
                return portfolio_id
        except Exception as e:
            logger.error(f"Error creating portfolio: {e}")
        finally:
            conn.close()
    return None

# Assigns a scan to a portfolio (only if user has edit rights)
def add_scan_to_portfolio(portfolio_id: int, scan_id: int, added_by_user_id: int) -> bool:
    role = get_user_role_in_portfolio(added_by_user_id, portfolio_id)
    if role not in ('owner', 'editor'):
        logger.warning(f"User {added_by_user_id} has no permission to add scans to portfolio {portfolio_id}")
        raise PermissionError("You do not have permission to add scans to this portfolio.")

    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO portfolio_scans (portfolio_id, scan_id, added_by_user_id) VALUES (%s, %s, %s);",
                    (portfolio_id, scan_id, added_by_user_id)
                )
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error adding scan to portfolio: {e}")
            raise
        finally:
            conn.close()
    raise RuntimeError("Database connection failed.")

# Adds another user to the portfolio with a role (editor/viewer).
def share_portfolio_with_user(portfolio_id: int, requesting_user_id: int, target_user_id: int, role: str = 'editor') -> bool:
    user_role = get_user_role_in_portfolio(requesting_user_id, portfolio_id)
    if user_role not in ['owner', 'editor']:
        logger.warning(f"User {requesting_user_id} attempted to share portfolio {portfolio_id} without permission.")
        raise PermissionError("Only owners or editors can share portfolios.")

    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                # Check if the user is already a member
                cur.execute(
                    "SELECT 1 FROM portfolio_members WHERE portfolio_id = %s AND user_id = %s;",
                    (portfolio_id, target_user_id)
                )
                if cur.fetchone():
                    raise ValueError("User is already a member of this portfolio.")

                cur.execute(
                    "INSERT INTO portfolio_members (portfolio_id, user_id, role) VALUES (%s, %s, %s);",
                    (portfolio_id, target_user_id, role)
                )
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error sharing portfolio: {e}")
            raise
        finally:
            conn.close()
    raise RuntimeError("Database connection failed.")

# Get all portfolios where the user is a member (including owner/editor/viewer)
def get_portfolios_for_user(user_id: int) -> list[tuple[int, str]]:
    conn = get_db_connection()
    portfolios = []
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT p.id, p.name
                    FROM portfolios p
                    JOIN portfolio_members pm ON p.id = pm.portfolio_id
                    WHERE pm.user_id = %s;
                """, (user_id,))
                portfolios = cur.fetchall()
        except Exception as e:
            logger.error(f"Error getting portfolios: {e}")
        finally:
            conn.close()
    return portfolios

# 1. Check if user has access to the portfolio
def has_access_to_portfolio(user_id: int, portfolio_id: int) -> bool:
    conn = get_db_connection()
    if not conn:
        return False
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 1
                FROM portfolio_members
                WHERE portfolio_id = %s AND user_id = %s;
            """, (portfolio_id, user_id))
            return cur.fetchone() is not None
    except Exception as e:
        logger.error(f"Error checking access for user {user_id} to portfolio {portfolio_id}: {e}")
        return False
    finally:
        conn.close()

# 2. Get all scans in the portfolio with encrypted data
def get_encrypted_scans_from_portfolio(portfolio_id: int) -> list[tuple[int, str, str, int]]:
    conn = get_db_connection()
    scans = []
    if not conn:
        return scans
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT sh.id, sh.scan_time, sh.detected_text, ps.added_by_user_id, sh.name
                FROM portfolio_scans ps
                JOIN scan_history sh ON ps.scan_id = sh.id
                WHERE ps.portfolio_id = %s
            """, (portfolio_id,))
            scans = cur.fetchall()
    except Exception as e:
        logger.error(f"Error fetching encrypted scans for portfolio {portfolio_id}: {e}")
    finally:
        conn.close()
    return scans

# Get decrypted scans only if access is valid
def get_scans_in_portfolio(user_id: int, portfolio_id: int) -> list[tuple[int, str, str]]:
    if not has_access_to_portfolio(user_id, portfolio_id):
        logger.warning(f"User {user_id} has no access to portfolio {portfolio_id}")
        return []

    encrypted_scans = get_encrypted_scans_from_portfolio(portfolio_id)
    decrypted_scans = []
    for scan_id, scan_time, encrypted_text, added_by_user_id, name in encrypted_scans:
        decrypted_text = decrypt_data(added_by_user_id, encrypted_text)
        decrypted_scans.append((scan_id, scan_time, name))

    return decrypted_scans

# Removes a specific scan from a given portfolio
def delete_scan_from_portfolio(portfolio_id: int, scan_id: int, requesting_user_id: int) -> bool:
    role = get_user_role_in_portfolio(requesting_user_id, portfolio_id)
    if role not in ['owner', 'editor']:
        logger.warning(f"User {requesting_user_id} tried to delete scan {scan_id} from portfolio {portfolio_id} without sufficient permission.")
        raise PermissionError("You do not have permission to remove scans from this portfolio.")

    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    DELETE FROM portfolio_scans
                    WHERE portfolio_id = %s AND scan_id = %s;
                """, (portfolio_id, scan_id))
                rows_deleted = cur.rowcount
                conn.commit()
                if rows_deleted == 0:
                    raise ValueError("No scan was removed — it may not exist in the specified portfolio.")
                return True
        except Exception as e:
            logger.error(f"Error deleting scan from portfolio: {e}")
            raise
        finally:
            conn.close()
    raise RuntimeError("Database connection failed.")

# Returns the role of a user in a portfolio
def get_user_role_in_portfolio(user_id: int, portfolio_id: int) -> str:
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT role FROM portfolio_members
                    WHERE portfolio_id = %s AND user_id = %s;
                """, (portfolio_id, user_id))
                result = cur.fetchone()
                if result:
                    return result[0]  # 'owner', 'editor', or 'viewer'
                else:
                    return 'notmember'
        except Exception as e:
            logger.error(f"Error checking user role in portfolio: {e}")
        finally:
            conn.close()
    return 'notmember'

# remove member 
def remove_member_from_portfolio(portfolio_id: int, user_id_to_remove: int, requesting_user_id: int) -> bool:
    role = get_user_role_in_portfolio(requesting_user_id, portfolio_id)
    if role != 'owner':
        logger.warning(f"User {requesting_user_id} tried to remove user {user_id_to_remove} but is not owner.")
        raise PermissionError("Only the owner can remove members.")

    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM portfolio_members WHERE portfolio_id = %s AND user_id = %s;",
                    (portfolio_id, user_id_to_remove)
                )
                conn.commit()
                return cur.rowcount > 0
        except Exception as e:
            logger.error(f"Error removing user from portfolio: {e}")
            raise
        finally:
            conn.close()
    raise RuntimeError("Database connection failed.")

# delete a specific portfolio and related data
def delete_portfolio(portfolio_id: int, requesting_user_id: int) -> bool:
    role = get_user_role_in_portfolio(requesting_user_id, portfolio_id)
    if role != 'owner':
        logger.warning(f"User {requesting_user_id} attempted to delete portfolio {portfolio_id} without owner permission.")
        raise PermissionError("Only the owner can delete this portfolio.")

    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM portfolios WHERE id = %s;", (portfolio_id,))
                conn.commit()
                return cur.rowcount > 0
        except Exception as e:
            logger.error(f"Error deleting portfolio: {e}")
            raise
        finally:
            conn.close()
    raise RuntimeError("Database connection failed.")

# get all the members of the portfolio
def get_portfolio_members(portfolio_id: int) -> list[tuple[str, str]]:
    conn = get_db_connection()
    members = []
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT u.username, pm.role 
                    FROM portfolio_members pm
                    JOIN users u ON pm.user_id = u.id
                    WHERE pm.portfolio_id = %s;
                """, (portfolio_id,))
                members = cur.fetchall()
        except Exception as e:
            logger.error(f"Error getting portfolio members: {e}")
        finally:
            conn.close()
    return members

def get_user_portfolios_and_unassigned_recordings(user_id: int) -> dict:
    """
    Returns the portfolios the user is a member of,
    and their scans that are not assigned to any portfolio.
    Format:
    {
        "portfolios": [(portfolio_id, name)],
        "recordings": [(scan_id, scan_time, decrypted_text)]
    }
    """
    result = {"portfolios": [], "recordings": []}

    try:
        # get portfolios for user
        result["portfolios"] = get_portfolios_for_user(user_id)
        user_name = get_user_name(user_id)
        if user_name:
            result["recordings"] = get_scan_history(user_name)
        else:
            logger.warning(f"User name not found for user_id {user_id}")
    except Exception as e:
        logger.error(f"Error retrieving portfolios and unassigned scans: {e}")

    return result


def get_user_name(user_id: int) -> str | None:
    conn = get_db_connection()
    if not conn:
        logger.error("Failed to get DB connection.")
        return None

    try:
        with conn.cursor() as cur:
            cur.execute("SELECT username FROM users WHERE id = %s;", (user_id,))
            result = cur.fetchone()
            if result:
                return result[0]
            else:
                return None  # User not found
    except Exception as e:
        logger.error(f"Error getting username: {e}")
        return None
    finally:
        conn.close()
   



def get_user_id(username: str) -> int:
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM users WHERE username = %s;", (username,))
                result = cur.fetchone()
                return result[0]
        except Exception as e:
            logger.error(f"Error getting user ID: {e}")
        finally:
            conn.close()    

# Function to login a user
def login_user(username: str, password: str) -> bool:
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                # Retrieve the hashed password for the user from the database
                cur.execute("SELECT password FROM users WHERE username = %s;", (username,))
                result = cur.fetchone()
                
                if result:
                    stored_hashed_password = result[0]
                    # Check if the provided password matches the stored hash
                    if bcrypt.checkpw(password.encode('utf-8'), stored_hashed_password.encode('utf-8')):
                        return True  # User is authenticated
                    else:
                        raise HTTPException(status_code=401, detail="Incorrect password")
                else:
                    raise HTTPException(status_code=404, detail="Username not found")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error during login: {str(e)}")
        finally:
            conn.close()

# Function to insert a new user into the database
def insert_user(username: str, password: str) -> int | None:
    conn = get_db_connection()
    if conn:
        try:
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            user_key = Fernet.generate_key()  #personal user key
            encrypted_user_key = encrypt_user_key(user_key)  # encrypt user key with MASTER_KEY
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO users (username, password, encryption_key) VALUES (%s, %s, %s) RETURNING id;",
                    (username, hashed_password, encrypted_user_key)
                )
                user_id = cur.fetchone()[0]
                conn.commit()
                logger.info(f"User added successfully with ID: {user_id}")
                return user_id
        except psycopg2.Error as e:
            if e.pgcode == "23505":  # Unique constraint violation
                logger.warning("Username already exists!")
            else:
                logger.error(f"Error inserting user: {e}")
        finally:
            conn.close()

def insert_scan(username: str, detected_text: str) -> None:
    conn = get_db_connection()
    if conn:
        try: 
            # Get the user_id based on the username
            with conn.cursor() as cur:
                user_id = get_user_id(username)

                if user_id is None:
                    logger.warning(f"No user found with username: {username}")
                    return None  # Return None if user is not found
                
                encrypted_text = encrypt_data(user_id, detected_text)
                if encrypted_text is None:
                    logger.warning("Encryption failed!")
                    return
                
                # Create a default name with formatted date (e.g., "21 Apr 2025 07:46 Recording")
                current_time = datetime.now()
                default_name = f"{current_time.strftime('%d %b %Y %H:%M')} Recording"
                
                cur.execute(
                    "INSERT INTO scan_history (user_id, detected_text, name) VALUES (%s, %s, %s);",
                    (user_id, encrypted_text, default_name)
                )
                conn.commit()
                logger.info(f"Scan history added successfully!")
        except psycopg2.Error as e:
            logger.error(f"Error inserting scan history: {e}")
        finally:
            conn.close()



def encrypt_data(user_id: int, plaintext: str) -> Optional[str]:
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                # Fetch the encrypted encryption_key from the database
                cur.execute("SELECT encryption_key FROM users WHERE id = %s;", (user_id,))
                encrypted_key = cur.fetchone()
                encrypted_key_bytes= bytes(encrypted_key[0])
                if encrypted_key:
                    # Decrypt the encryption key using the MASTER_KEY
                    decrypted_key= decrypt_user_key(encrypted_key_bytes)
                    # Use the decrypted key to encrypt the plaintext
                    cipher = Fernet(decrypted_key)
                    encrypted_text = cipher.encrypt(plaintext.encode('utf-8'))
                    # Convert encrypted bytes to hex string for storage in TEXT field
                    return encrypted_text.hex()
        except Exception as e:
            logger.error(f"Encryption Error: {e}")
        finally:
            conn.close()
    return None

        
def decrypt_data(user_id, encrypted_text):
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT encryption_key FROM users WHERE id = %s;", (user_id,))
                key = cur.fetchone()
                if key:
                    # Ensure the key is in bytes
                    key_bytes = bytes(key[0])

                    # Decrypt the encryption key
                    decrypted_key = decrypt_user_key(key_bytes)

                    cipher = Fernet(decrypted_key)
                    
                    # Convert hex string back to bytes - no need for cleaning or replacing
                    try:
                        encrypted_text_bytes = binascii.unhexlify(encrypted_text)
                        decrypted_text = cipher.decrypt(encrypted_text_bytes).decode('utf-8')
                        return decrypted_text
                    except Exception as e:
                        logger.error(f"Error decrypting text: {e}")
                        logger.error(f"Encrypted text: {encrypted_text}")
                        return f"Decryption failed: {str(e)}"
                else:
                    logger.warning("No encryption key found for the user!")
        except Exception as e:
            logger.error(f"Encryption Error: {e}")
        finally:
            conn.close()
    return None


def get_scan_history(username: str) -> list[tuple[int, str, str]]:
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                # Fetch the user_id based on the provided username
                cur.execute("SELECT id FROM users WHERE username = %s;", (username,))
                user_id_result = cur.fetchone()
                if user_id_result:
                    user_id = user_id_result[0]  # Extract user_id from the result
                    # Fetch the scan history for the user, including the name column
                    cur.execute("SELECT id, scan_time, detected_text, name FROM scan_history WHERE user_id = %s;", (user_id,))
                    scans = cur.fetchall()
                    decrypted_scans = [(scan[0], scan[1], scan[3]) for scan in scans]  # Use scan[3] for name
                    return decrypted_scans
                else:
                    logger.warning("No user found")
                    return []
        except Exception as e:
            logger.error(f"Error fetching scan history: {e}")
        finally:
            conn.close()
    return []

def get_scan_history_by_id(user_id: int, record_id: int) -> list[tuple[int, str, str]]:
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT id, scan_time, detected_text FROM scan_history WHERE id = %s;", (record_id,))
                scan = cur.fetchone()
                decrypted_scan = [(scan[0], scan[1], decrypt_data(user_id, scan[2]))]
                return decrypted_scan
        except Exception as e:
            logger.error(f"Error fetching scan history: {e}")
        finally:
            conn.close()


def create_session_table():
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("CREATE TABLE IF NOT EXISTS sessions (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, session_id TEXT UNIQUE NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);")
                conn.commit()
        except Exception as e:
            logger.error(f"Error creating table: {e}")
        finally:
            conn.close()
            
def insert_session(user_id: int, session_id: str):
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("INSERT INTO sessions (user_id, session_id) VALUES (%s, %s);", (user_id, session_id))
                conn.commit()   
        except Exception as e:
            logger.error(f"Error inserting session: {e}")
        finally:
            conn.close()
            
            
def get_session(session_id: str) -> Optional[User]:
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM users WHERE id = (SELECT user_id FROM sessions WHERE session_id = %s);", (session_id,))
                result = cur.fetchone() 
                if result:
                    return User(id=result[0], username=result[1])
                else:
                    return None
        except Exception as e:
            logger.error(f"Error getting session: {e}")
        finally:
            conn.close()
    return None

def delete_session(session_id: str):
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM sessions WHERE session_id = %s;", (session_id,))
                conn.commit()
        except Exception as e:
            logger.error(f"Error deleting session: {e}")    
        finally:
            conn.close()
    return None



def delete_user(username: str):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM users WHERE username = %s", (username,))
        conn.commit()
    finally:
        cur.close()
        conn.close()


def delete_sessions_for_user(user_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM sessions WHERE user_id = %s", (user_id,))
        conn.commit()
    finally:
        cur.close()
        conn.close()

def get_scan_count_for_user(user_id: int) -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Assuming your scan_history table has a user_id column instead of username
        cur.execute("SELECT COUNT(*) FROM scan_history WHERE user_id = %s", (user_id,))
        result = cur.fetchone()
        return result[0] if result else 0
    finally:
        cur.close()
        conn.close()

def delete_record(record_id: str):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM scan_history WHERE id = %s", (record_id,))
        rows_affected = cur.rowcount
        conn.commit()
        return rows_affected > 0
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()  

def rename_portfolio(portfolio_id: int, new_name: str, requesting_user_id: int) -> bool:
    role = get_user_role_in_portfolio(requesting_user_id, portfolio_id)
    if role != 'owner':
        logger.warning(f"User {requesting_user_id} attempted to rename portfolio {portfolio_id} without owner permission.")
        raise PermissionError("Only the owner can rename this portfolio.")

    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("UPDATE portfolios SET name = %s WHERE id = %s;", (new_name, portfolio_id))
                conn.commit()
                return cur.rowcount > 0
        except Exception as e:
            logger.error(f"Error renaming portfolio: {e}")
            raise
        finally:
            conn.close()
    raise RuntimeError("Database connection failed.")  

def update_scan_name(scan_id: int, user_id: int, new_name: str) -> bool:
    """
    Rename a scan if it belongs to the specified user.
    Returns True if successful, False otherwise.
    """
    conn = get_db_connection()
    if not conn:
        logger.error("Failed to connect to database")
        return False

    try:
        with conn.cursor() as cur:
            # Check if the scan belongs to the user
            cur.execute("SELECT user_id FROM scan_history WHERE id = %s;", (scan_id,))
            result = cur.fetchone()
            if not result:
                logger.warning(f"Scan {scan_id} not found")
                return False
            if result[0] != user_id:
                logger.warning(f"User {user_id} attempted to rename scan {scan_id} without permission")
                return False

            # Update the scan name
            cur.execute("UPDATE scan_history SET name = %s WHERE id = %s;", (new_name, scan_id))
            conn.commit()
            return True
    except Exception as e:
        logger.error(f"Error renaming scan: {e}")
        return False
    finally:
        conn.close()  

def ensure_scan_history_columns():
    """Ensure all required columns exist in the scan_history table."""
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                # Check if name column exists
                cur.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'scan_history' AND column_name = 'name';
                """)
                if not cur.fetchone():
                    # Add name column if it doesn't exist
                    cur.execute("""
                        ALTER TABLE scan_history 
                        ADD COLUMN name TEXT;
                    """)
                    # Update existing rows with default names based on scan_time
                    cur.execute("""
                        UPDATE scan_history 
                        SET name = scan_time::text 
                        WHERE name IS NULL;
                    """)
                    conn.commit()
                    logger.info("Added name column to scan_history table")
        except Exception as e:
            logger.error(f"Error ensuring scan_history columns: {e}")
        finally:
            conn.close()

def update_existing_scan_names():
    """Update existing scan names to use the new format."""
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                # Update all scan names that are in the old format
                cur.execute("""
                    UPDATE scan_history 
                    SET name = TO_CHAR(scan_time, 'DD Mon YYYY HH24:MI') || ' Recording'
                    WHERE name NOT LIKE '% Recording';
                """)
                conn.commit()
                logger.info("Updated existing scan names to new format")
        except Exception as e:
            logger.error(f"Error updating scan names: {e}")
        finally:
            conn.close()
