

import cv2
import numpy as np
import os
import time
from datetime import datetime

def detect_popup_notification(frame, previous_frame, threshold=0.10):
    """

    we need to  dfetect if a new popup notification has appeared by comparing the current frame
    with the previous frame and looking for significant changes in specific regions
    

    the threshold argument in the func means the difference threshold to consider a change significant
        
    
    the functinm will return true if a popup is detected false otherwise
   
    """
    if previous_frame is None:
        return False
    
    # Convert frames to grayscale for easier comparison
    gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray_prev = cv2.cvtColor(previous_frame, cv2.COLOR_BGR2GRAY)
    
    # Calculate absolute difference between frames
    frame_diff = cv2.absdiff(gray_frame, gray_prev)
    
    # Calculate the percentage of changed pixels
    change_percentage = np.sum(frame_diff > 30) / frame_diff.size
    
    # Consider it a popup if the change is above threshold but not too large
    # (too large might indicate a scene change rather than a popup)
    return threshold < change_percentage < 0.40

def analyze_video(video_path, output_file):
    """
   analyze video frames and save timestamps of popup notifications to a text file
    to be soon sent to the screenshots system 
    """
    # Open the video file
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        print(f"Error: Could not open video {video_path}")
        return
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = frame_count / fps
    
    print(f"Video FPS: {fps}")
    print(f"Video duration: {duration:.2f} seconds")
    
    # Initialize variables
    previous_frame = None
    frame_number = 0
    current_time = 0
    
    # Create a list to store timestamps
    popup_timestamps = []
    
    while cap.isOpened():
        # Read a frame
        ret, frame = cap.read()
        
        if not ret:
            break
        
        frame_number += 1
        current_time = frame_number / fps
        
        # Process one frame per second
        if current_time % 1.0 < 1.0/fps:
            # Check for popup
            if previous_frame is not None and detect_popup_notification(frame, previous_frame):
                # Add timestamp to list
                popup_timestamps.append(current_time)
                print(f"Notification detected at {current_time:.2f}s")
            
            # Update the previous frame
            previous_frame = frame.copy()
    
    # Release resources
    cap.release()
    
    # Write timestamps to text file
    with open(output_file, 'w') as f:
        f.write("Popup Notification Timestamps (seconds):\n")
        for timestamp in popup_timestamps:
            f.write(f"{timestamp:.2f}\n")
    
    print(f"Video analysis complete! Timestamps saved to {output_file}")

# Example usage
video_path =  "croppedOtpVideo.mov"  # Replace with your video path
output_file = "popup_timestamps.txt"   # File to save detected popup timestamps
analyze_video(video_path, output_file)