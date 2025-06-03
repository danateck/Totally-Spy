export const CAMERA_CONFIG = {
    // Image capture settings
    CAPTURE_INTERVAL_MS: 50,        // How often to capture images
    MAX_STORED_IMAGES: 20,          // Maximum number of images to store in buffer
    SEND_INTERVAL_MS: 750,          // How often to send top images to server
    TOP_IMAGES_TO_SEND: 3,          // Number of top images to send each time
    
    // Image quality settings
    MAX_IMAGE_DIMENSION: 2000,      // Maximum width or height for captured images
    JPEG_QUALITY: 0.95,             // JPEG quality for captured images (0-1)
    
    // Image processing settings
    SHARPNESS_WEIGHT: 0.5,          // Weight for sharpness in image scoring
    CONTRAST_WEIGHT: 0.3,           // Weight for contrast in image scoring
    COLORFULNESS_WEIGHT: 0.2,       // Weight for colorfulness in image scoring
} as const; 