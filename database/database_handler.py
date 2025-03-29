import os
import psycopg2
import bcrypt
from dotenv import load_dotenv
from cryptography.fernet import Fernet
import binascii

# Load environment variables from .env file
load_dotenv()

# PostgreSQL connection details
DB_CONFIG = {
    "dbname": os.getenv("DB_NAME"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "host": os.getenv("DB_HOST"),
    "port": os.getenv("DB_PORT"),
}

# Connect to PostgreSQL
def get_db_connection():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print("Database connection failed:", e)
        return None
    
#MASTER_KEY encrypts each user_key that is stored in db  
MASTER_KEY = os.getenv("MASTER_KEY")
if not MASTER_KEY:
    raise ValueError("Master key is not set in environment variables")

#user key is used to encrypt the scan results
def encrypt_user_key(user_key):
    cipher = Fernet(MASTER_KEY)
    return cipher.encrypt(user_key)

def decrypt_user_key(encrypted_key):
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
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        encryption_key BYTEA
                    );
                """)
                conn.commit()
                print("Users table created successfully.")
        except Exception as e:
            print("Error creating table:", e)
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
                print("Scan history table created successfully.")
        except Exception as e:
            print("Error creating table:", e)
        finally:
            conn.close()


# Function to login a user
def login_user(username, password):
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
                        print("Login successful!")
                        return True  # User is authenticated
                    else:
                        print("Incorrect password.")
                        return False
                else:
                    print("Username not found.")
                    return False
        except Exception as e:
            print("Error during login:", e)
        finally:
            conn.close()

# Function to insert a new user into the database
def insert_user(username, password):
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
                print("User added successfully with ID:", user_id)
                return user_id
        except psycopg2.Error as e:
            if e.pgcode == "23505":  # Unique constraint violation
                print("Username already exists!")
            else:
                print("Error inserting user:", e)
        finally:
            conn.close()

def insert_scan(username, detected_text):
    conn = get_db_connection()
    if conn:
        try: 
            # Get the user_id based on the username
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM users WHERE username = %s;", (username,))
                user_id_row = cur.fetchone()

                if user_id_row is None:
                    print(f"No user found with username: {username}")
                    return None  # Return None if user is not found
                
                user_id = user_id_row[0]
                encrypted_text = encrypt_data(user_id, detected_text)
                if encrypted_text is None:
                    print("Encryption failed!")
                    return
                
                cur.execute(
                    "INSERT INTO scan_history (user_id, detected_text) VALUES (%s, %s);",
                    (user_id, encrypted_text)
                )
                conn.commit()
                print("Scan history added successfully.")
        except psycopg2.Error as e:
            print("Error inserting scan history:", e)
        finally:
            conn.close()


def encrypt_data(user_id, plaintext):
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
                    return encrypted_text
        except Exception as e:
            print("Encryption error:", e)
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
                    # Convert the hex string to bytes
                    encrypted_text_cleaned = encrypted_text.replace('\\x', '')
                    encrypted_text_bytes = binascii.unhexlify(encrypted_text_cleaned)
                    decrypted_text = cipher.decrypt(encrypted_text_bytes).decode('utf-8')
                    print("Decrypted text:", decrypted_text)
                else:
                    print("No encryption key found for the user!")
        except Exception as e:
            print("Decryption error:", e)  # This will print the exception message
        finally:
            conn.close()
    return None


def get_scan_history(username):
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                # Fetch the user_id based on the provided username
                cur.execute("SELECT id FROM users WHERE username = %s;", (username,))
                user_id_result = cur.fetchone()
                if user_id_result:
                    user_id = user_id_result[0]  # Extract user_id from the result
                    # Fetch the scan history for the user
                    cur.execute("SELECT id, scan_time, detected_text FROM scan_history WHERE user_id = %s;", (user_id,))
                    scans = cur.fetchall()
                    decrypted_scans = [(scan[0], scan[1], decrypt_data(user_id, scan[2])) for scan in scans]
                    return decrypted_scans
                else:
                    print("User not found.")
                    return []
        except Exception as e:
            print("Error fetching scan history:", e)
        finally:
            conn.close()
    return []



# Run table creation when the script is executed
if __name__ == "__main__":
    #login_user("tom12","123")
    get_scan_history("tom12")