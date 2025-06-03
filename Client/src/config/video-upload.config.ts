// Configuration object for all video upload settings
export const VIDEO_UPLOAD_CONFIG = {
  // File size limits
  MAX_FILE_SIZE: 500 * 1024 * 1024, // 500MB in bytes
  
  // Supported file types
  SUPPORTED_FILE_TYPES: {
    MIME_TYPES: [
      'video/mp4',
      'video/webm',
      'video/avi',
      'video/mov',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-ms-wmv',
      'video/mkv',
      'video/x-matroska'
    ],
    EXTENSIONS: [
      '.mp4',
      '.webm',
      '.avi',
      '.mov',
      '.wmv',
      '.mkv'
    ]
  },
  
  // Processing settings
  PROCESSING: {
    FAST_MODE: {
      FRAMES_PER_SECOND: 4,
      JPEG_QUALITY: 0.7,
      DELAY_BETWEEN_REQUESTS: 25, // milliseconds
      BATCH_SIZE: 5, // seconds processed in parallel
    },
    NORMAL_MODE: {
      FRAMES_PER_SECOND: 8,
      JPEG_QUALITY: 0.8,
      DELAY_BETWEEN_REQUESTS: 100, // milliseconds
      BATCH_SIZE: 1, // sequential processing
    },
    BEST_FRAMES_PER_SECOND: 3,
  },
  
  // Timeouts and delays
  TIMEOUTS: {
    VIDEO_METADATA_LOAD: 10000, // 10 seconds
    AUTO_REMOVE_VIDEO: 2000, // 2 seconds after processing
  },
  
  // Quality calculation settings
  QUALITY_ANALYSIS: {
    ENTROPY_SAMPLE_SIZE: 1000,
    ENTROPY_SAMPLE_STEP: 10,
  }
} as const;

// Type export for TypeScript intellisense
export type VideoUploadConfig = typeof VIDEO_UPLOAD_CONFIG; 