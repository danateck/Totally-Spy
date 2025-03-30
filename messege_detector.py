import cv2
import numpy as np
import os
import time
from datetime import datetime

def detect_popup_notification(frame, previous_frame, threshold=0.10):
    """
    Detect if a new popup notification has appeared by comparing frames.
    
    Args:
        frame: Current video frame
        previous_frame: Previous video frame
        threshold: Difference threshold to consider a change significant
        
    Returns:
        bool: True if a popup is detected, False otherwise
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
    return threshold < change_percentage < 0.40

def analyze_video(video_path, output_folder):
    """
    Analyze video frames to precisely detect when notifications appear within 1.5s intervals.
    
    Args:
        video_path: Path to the video file
        output_folder: Folder to save detection result text files
    """
    # Create output folder if it doesn't exist
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
    
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
    interval_size = 1.5  # Each interval is 1.5 seconds
    interval_number = 0
    
    while interval_number * interval_size < duration:
        # Define the current interval
        interval_start = interval_number * interval_size
        interval_end = (interval_number + 1) * interval_size
        
        # Adjust last interval if it exceeds video duration
        if interval_end > duration:
            interval_end = duration
        
        # List to store detection results in this interval
        detections = []
        
        # Set position to start of interval
        cap.set(cv2.CAP_PROP_POS_MSEC, interval_start * 1000)
        
        # Initialize time and frame for this interval
        current_time = interval_start
        last_frame = None
        
        # Process all frames in this interval
        while current_time < interval_end:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Get current timestamp
            current_time = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000
            
            # Check for notification if we have a previous frame
            if last_frame is not None:
                is_notification = detect_popup_notification(frame, last_frame)
                if is_notification:
                    # Store the exact time where notification was detected
                    detections.append(current_time)
            
            # Update last frame
            last_frame = frame.copy()
        
        # Create report for this interval
        if detections:
            # Format result text with exact detection times
            result_text = f"Interval {interval_start:.1f}-{interval_end:.1f}:\n"
            
            # Group consecutive detections
            if len(detections) > 0:
                detection_ranges = []
                start_time = detections[0]
                last_time = detections[0]
                
                for i in range(1, len(detections)):
                    # If detections are close (within 0.1s), group them
                    if detections[i] - last_time < 0.1:
                        last_time = detections[i]
                    else:
                        # Save the current range and start a new one
                        detection_ranges.append((start_time, last_time))
                        start_time = detections[i]
                        last_time = detections[i]
                
                # Add the last range
                detection_ranges.append((start_time, last_time))
                
                # Format the detection ranges
                for i, (start, end) in enumerate(detection_ranges):
                    if start == end:
                        result_text += f"  Detection {i+1}: at {start:.2f}s\n"
                    else:
                        result_text += f"  Detection {i+1}: {start:.2f}-{end:.2f}s\n"
            
            # Create filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            file_name = f"notification_interval_{interval_start:.1f}_{interval_end:.1f}_{timestamp}.txt"
            file_path = os.path.join(output_folder, file_name)
            
            # Save to file
            with open(file_path, 'w') as f:
                f.write(result_text)
            
            print(f"Interval {interval_start:.1f}-{interval_end:.1f}: Notifications detected at specific times")
            print(f"Saved to {file_path}")
        else:
            print(f"Interval {interval_start:.1f}-{interval_end:.1f}: No notifications detected")
        
        # Move to next interval
        interval_number += 1
    
    # Release resources
    cap.release()
    print("Video analysis complete!")

def analyze_live_video(camera_index, output_folder, duration=None):
    """
    Analyze live video to precisely detect when notifications appear within 1.5s intervals.
    
    Args:
        camera_index: Index of the camera (usually 0 for built-in webcam)
        output_folder: Folder to save detection result text files
        duration: Optional duration in seconds to analyze (None for indefinite)
    """
    # Create output folder if it doesn't exist
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
    
    # Open the video stream
    cap = cv2.VideoCapture(camera_index)
    
    if not cap.isOpened():
        print(f"Error: Could not open camera {camera_index}")
        return
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0:
        fps = 30  # Default assumption if camera doesn't report FPS
    
    print(f"Camera FPS: {fps}")
    
    # Initialize variables
    start_time = time.time()
    last_interval_time = start_time
    last_frame = None
    detections = []
    interval_size = 1.5  # Each interval is 1.5 seconds
    
    try:
        while True:
            # Check if we've reached the specified duration
            if duration is not None and (time.time() - start_time) > duration:
                break
            
            # Read a frame
            ret, frame = cap.read()
            
            if not ret:
                print("Failed to grab frame")
                break
            
            current_time = time.time()
            
            # Check for notification if we have a previous frame
            if last_frame is not None:
                is_notification = detect_popup_notification(frame, last_frame)
                if is_notification:
                    # Record exact time of detection (relative to interval start)
                    relative_time = current_time - last_interval_time
                    absolute_time = current_time - start_time
                    detections.append((relative_time, absolute_time))
            
            # If we've reached the end of an interval
            if current_time - last_interval_time >= interval_size:
                interval_start = last_interval_time - start_time
                interval_end = current_time - start_time
                
                # Create report for this interval
                if detections:
                    # Format result text with exact detection times
                    result_text = f"Interval {interval_start:.1f}-{interval_end:.1f}:\n"
                    
                    # Group consecutive detections
                    if len(detections) > 0:
                        detection_ranges = []
                        start_rel, start_abs = detections[0]
                        last_rel, last_abs = detections[0]
                        
                        for i in range(1, len(detections)):
                            rel_time, abs_time = detections[i]
                            # If detections are close (within 0.1s), group them
                            if abs_time - last_abs < 0.1:
                                last_rel, last_abs = rel_time, abs_time
                            else:
                                # Save the current range and start a new one
                                detection_ranges.append((start_abs, last_abs))
                                start_rel, start_abs = rel_time, abs_time
                                last_rel, last_abs = rel_time, abs_time
                        
                        # Add the last range
                        detection_ranges.append((start_abs, last_abs))
                        
                        # Format the detection ranges
                        for i, (start, end) in enumerate(detection_ranges):
                            if abs(start - end) < 0.05:
                                result_text += f"  Detection {i+1}: at {start:.2f}s\n"
                            else:
                                result_text += f"  Detection {i+1}: {start:.2f}-{end:.2f}s\n"
                    
                    # Create filename with timestamp
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
                    file_name = f"notification_interval_{interval_start:.1f}_{interval_end:.1f}_{timestamp}.txt"
                    file_path = os.path.join(output_folder, file_name)
                    
                    # Save to file
                    with open(file_path, 'w') as f:
                        f.write(result_text)
                    
                    print(f"Interval {interval_start:.1f}-{interval_end:.1f}: Notifications detected at specific times")
                    print(f"Saved to {file_path}")
                else:
                    print(f"Interval {interval_start:.1f}-{interval_end:.1f}: No notifications detected")
                
                # Reset for next interval
                last_interval_time = current_time
                detections = []
            
            # Update last frame
            last_frame = frame.copy()
            
            # Display the frame
            cv2.imshow('Live Video Analysis', frame)
            
            # Break if 'q' is pressed
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
                
    except KeyboardInterrupt:
        print("Analysis stopped by user")
    
    # Release resources
    cap.release()
    cv2.destroyAllWindows()
    print("Live video analysis complete!")

# Example usage
# For pre-recorded video:
# video_path = "path_to_your_video.mp4"  # Replace with your video path
# output_folder = "notification_results"  # Folder to save results
# analyze_video(video_path, output_folder)

# For live video:
camera_index = 0  # Usually 0 for built-in webcam
output_folder = "live_notification_results"  # Folder to save results
analyze_live_video(camera_index, output_folder)