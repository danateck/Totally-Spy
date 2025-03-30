import cv2
import numpy as np
import os
import shutil

def sort_images_by_message(input_folder):
    """
    sorts the  images into 'yes' and 'no' folders based on whether they contain a message.

    
    and returns a tuple (yes_folder_path, no_folder_path, results_dict)
    """
    # Create output folders as subfolders of the input folder
    yes_folder = os.path.join(input_folder, "yes")
    no_folder = os.path.join(input_folder, "no")
    
    # Create the folders if they don't exist
    if not os.path.exists(yes_folder):
        os.makedirs(yes_folder)
    
    if not os.path.exists(no_folder):
        os.makedirs(no_folder)
    
    # Get all image files
    image_extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.gif']
    image_files = []
    
    for file in os.listdir(input_folder):
        file_path = os.path.join(input_folder, file)
        if os.path.isfile(file_path) and any(file.lower().endswith(ext) for ext in image_extensions):
            image_files.append(file_path)
    
    print(f"Found {len(image_files)} images to classify")
    
    # Dictionary to store results
    results = {}
    
    # Process each image
    for image_path in image_files:
        file_name = os.path.basename(image_path)
        
        # Detect if it has a message using a simple edge detection method
        has_message = detect_message_in_image(image_path)
        
        # Copy to the appropriate folder
        if has_message:
            destination = os.path.join(yes_folder, file_name)
            results[file_name] = "yes"
            print(f"{file_name}: YES (has message)")
        else:
            destination = os.path.join(no_folder, file_name)
            results[file_name] = "no"
            print(f"{file_name}: NO (no message)")
        
        # Copy the file
        shutil.copy2(image_path, destination)
    
    print(f"Classification complete! Images sorted into:")
    print(f"  - Yes folder: {yes_folder}")
    print(f"  - No folder: {no_folder}")
    
    return yes_folder, no_folder, results

def detect_message_in_image(image_path, threshold=0.15):
    """
    Detect if an image contains a message notification.
    This function uses multiple techniques to improve accuracy.
    
    
     True if a message is detected, False otherwise
    """
    # Read the image
    image = cv2.imread(image_path)
    
    if image is None:
        print(f"Error: Could not read image {image_path}")
        return False
    
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Method 1: Edge detection for UI elements
    edges = cv2.Canny(gray, 50, 150)
    edge_percentage = np.sum(edges > 0) / edges.size
    
    # Method 2: Check for text-like patterns using morphology
    # Text typically has horizontal structures
    kernel = np.ones((1, 5), np.uint8)
    text_structures = cv2.morphologyEx(gray, cv2.MORPH_OPEN, kernel)
    text_diff = cv2.absdiff(gray, text_structures)
    text_percentage = np.sum(text_diff > 30) / text_diff.size
    
    # Method 3: Check for notification-typical colors
    # Many notifications use distinct colors
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    
    # Blue range (common for messaging apps)
    lower_blue = np.array([100, 50, 50])
    upper_blue = np.array([140, 255, 255])
    blue_mask = cv2.inRange(hsv, lower_blue, upper_blue)
    blue_percentage = np.sum(blue_mask > 0) / blue_mask.size
    
    # Green range (common for messaging apps)
    lower_green = np.array([40, 50, 50])
    upper_green = np.array([80, 255, 255])
    green_mask = cv2.inRange(hsv, lower_green, upper_green)
    green_percentage = np.sum(green_mask > 0) / green_mask.size
    
    # Combined detection score
    detection_score = edge_percentage + text_percentage + 2*(blue_percentage + green_percentage)
    
    return detection_score > threshold