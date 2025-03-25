import os
import psycopg2
import bcrypt
from dotenv import load_dotenv

# Load environment variables from .env file (if needed)
load_dotenv()

# PostgreSQL connection details
DB_CONFIG = {
    "dbname": "totally_spy",
    "user": "postgres",
    "password": "131201",  # Change this to match your actual PostgreSQL password
    "host": "localhost",
    "port": "5432",
}

# Connect to PostgreSQL
def get_db_connection():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print("Database connection failed:", e)
        return None

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
                    );
                """)
                conn.commit()
                print("Users table created successfully.")
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
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO users (username, password) VALUES (%s, %s) RETURNING id;",
                    (username, hashed_password)
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

# Run table creation when the script is executed
if __name__ == "__main__":
    #et_db_connection()

    # Test: Add a user (uncomment the line below to test)
    #insert_user("agam", "123")
    login_user("emily","123")
