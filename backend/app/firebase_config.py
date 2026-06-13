import os
import firebase_admin
from firebase_admin import credentials, firestore

def initialize_firebase():
    """Initializes the Firebase Admin SDK securely using environment variables."""
    # Look for the path designated in your environment vars
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    
    if not firebase_admin._apps:
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            print("Firebase Admin SDK initialized successfully with Service Account.")
        else:
            # Fallback for cloud platforms (e.g., Google Cloud/Vercel) where it reads environmental defaults
            firebase_admin.initialize_app()
            print("Firebase Admin SDK initialized with default application credentials.")

    # Return the firestore database client wrapper instance
    return firestore.client()

# Create a singleton DB instance for your agents to use
db = initialize_firebase()
