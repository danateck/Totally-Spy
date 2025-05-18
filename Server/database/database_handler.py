import os
import psycopg2
import bcrypt
from dotenv import load_dotenv
from cryptography.fernet import Fernet
import binascii
from fastapi import HTTPException
import logging
from typing import Optional

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
                        detected_text TEXT NOT NULL
                    );
                """)
                conn.commit()
        except Exception as e:
            logger.error(f"Error creating table: {e}")
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
                
                cur.execute(
                    "INSERT INTO scan_history (user_id, detected_text) VALUES (%s, %s);",
                    (user_id, encrypted_text)
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

        
# def decrypt_data(user_id, encrypted_text):
#     conn = get_db_connection()
#     if conn:
#         try:
#             with conn.cursor() as cur:
#                 cur.execute("SELECT encryption_key FROM users WHERE id = %s;", (user_id,))
#                 key = cur.fetchone()
#                 if key:
#                     # Ensure the key is in bytes
#                     key_bytes = bytes(key[0])

#                     # Decrypt the encryption key
#                     decrypted_key = decrypt_user_key(key_bytes)

#                     cipher = Fernet(decrypted_key)
                    
#                     # Convert hex string back to bytes - no need for cleaning or replacing
#                     try:
#                         encrypted_text_bytes = binascii.unhexlify(encrypted_text)
#                         decrypted_text = cipher.decrypt(encrypted_text_bytes).decode('utf-8')
#                         return decrypted_text
#                     except Exception as e:
#                         logger.error(f"Error decrypting text: {e}")
#                         logger.error(f"Encrypted text: {encrypted_text}")
#                         return f"Decryption failed: {str(e)}"
#                 else:
#                     logger.warning("No encryption key found for the user!")
#         except Exception as e:
#             logger.error(f"Encryption Error: {e}")
#         finally:
#             conn.close()
#     return None

def decrypt_data(encryption_key: bytes, encrypted_text: str) -> Optional[str]:
    try:
        # Ensure encryption_key is bytes (handle case where it's a tuple from fetchone)
        if isinstance(encryption_key, tuple):
            encryption_key = encryption_key[0]
        if not isinstance(encryption_key, bytes):
            raise ValueError("Encryption key must be bytes")

        decrypted_key = decrypt_user_key(encryption_key)
        if not isinstance(decrypted_key, (bytes, str)):
            raise ValueError("Decrypted key is not bytes or string")

        cipher = Fernet(decrypted_key)

        # Ensure encrypted_text is a proper hex string before unhexlify
        if not isinstance(encrypted_text, str):
            raise ValueError("Encrypted text must be a string")
        encrypted_text_bytes = binascii.unhexlify(encrypted_text)

        decrypted_text = cipher.decrypt(encrypted_text_bytes).decode('utf-8')
        return decrypted_text

    except Exception as e:
        logger.error(f"Error decrypting text: {e}")
        return f"Decryption failed: {str(e)}"




# def get_scan_history(username: str) -> list[tuple[int, str, str]]:
#     conn = get_db_connection()
#     if conn:
#         try:
#             with conn.cursor() as cur:
#                 # Fetch the user_id based on the provided username
#                 cur.execute("SELECT id FROM users WHERE username = %s;", (username,))
#                 user_id_result = cur.fetchone()
#                 if user_id_result:
#                     user_id = user_id_result[0]  # Extract user_id from the result
#                     # Fetch the scan history for the user
#                     cur.execute("SELECT id, scan_time, detected_text FROM scan_history WHERE user_id = %s;", (user_id,))
#                     scans = cur.fetchall()
#                     decrypted_scans = [(scan[0], scan[1], decrypt_data(user_id, scan[2])) for scan in scans]
#                     return decrypted_scans
#                 else:
#                     logger.warning("No user found")
#                     return []
#         except Exception as e:
#             logger.error(f"Error fetching scan history: {e}")
#         finally:
#             conn.close()
#     return []

def get_scan_history(username: str) -> list[tuple[int, str, str]]:
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT id, encryption_key FROM users WHERE username = %s;", (username,))
                user_result = cur.fetchone()
                if not user_result:
                    return []
                user_id, encrypted_key = user_result
                decrypted_key = bytes(encrypted_key)

                cur.execute("SELECT id, scan_time, detected_text FROM scan_history WHERE user_id = %s;", (user_id,))
                scans = cur.fetchall()
                return [(scan[0], scan[1], decrypt_data(decrypted_key, scan[2])) for scan in scans]
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
                # First, get the user's encryption key
                cur.execute("SELECT encryption_key FROM users WHERE id = %s;", (user_id,))
                encryption_key_result = cur.fetchone()
                
                if not encryption_key_result:
                    logger.warning(f"No encryption key found for user ID: {user_id}")
                    return []
                
                encrypted_key = bytes(encryption_key_result[0])
                
                # Then get the scan record
                cur.execute("SELECT id, scan_time, detected_text FROM scan_history WHERE id = %s;", (record_id,))
                scan = cur.fetchone()
                
                if not scan:
                    logger.warning(f"No scan found with ID: {record_id}")
                    return []
                
                decrypted_scan = [(scan[0], scan[1], decrypt_data(encrypted_key, scan[2]))]
                return decrypted_scan
        except Exception as e:
            logger.error(f"Error fetching scan history: {e}")
        finally:
            conn.close()
    return []


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