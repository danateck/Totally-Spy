import React, { useState, useRef, useCallback } from "react";
import { Upload, Play, Pause, X, CheckCircle, AlertCircle, Zap, Clock } from "lucide-react";
import { getTopFramesFromBase64 } from "@/lib/image-quality";
import { VIDEO_UPLOAD_CONFIG } from "@/config/video-upload.config";

interface VideoUploadProps {
  onClose: () => void;
}

type ProcessingMode = 'fast' | 'normal';

// Simplified quality calculation for speed
const calculateSimpleQuality = (frameData: string): number => {
  // Use data size and some basic entropy as a quick quality metric
  const dataSize = frameData.length;
  
  // Sample only every Nth character for entropy calculation (much faster)
  const sample = frameData.slice(0, Math.min(VIDEO_UPLOAD_CONFIG.QUALITY_ANALYSIS.ENTROPY_SAMPLE_SIZE, frameData.length));
  const charCounts: { [key: string]: number } = {};
  
  for (let i = 0; i < sample.length; i += VIDEO_UPLOAD_CONFIG.QUALITY_ANALYSIS.ENTROPY_SAMPLE_STEP) {
    const char = sample[i];
    charCounts[char] = (charCounts[char] || 0) + 1;
  }
  
  let entropy = 0;
  const sampleLength = sample.length / VIDEO_UPLOAD_CONFIG.QUALITY_ANALYSIS.ENTROPY_SAMPLE_STEP;
  for (const count of Object.values(charCounts)) {
    const probability = count / sampleLength;
    entropy -= probability * Math.log2(probability);
  }
  
  return dataSize * entropy;
};

const VideoUpload: React.FC<VideoUploadProps> = ({ onClose }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [portfolioId, setPortfolioId] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("");
  const [completedFrames, setCompletedFrames] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('fast');
  const [portfolioName, setPortfolioName] = useState<string>("");
  const [fileSizeError, setFileSizeError] = useState<string>("");
  const [fileTypeError, setFileTypeError] = useState<string>("");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFileType = (file: File): boolean => {
    const isValidMimeType = VIDEO_UPLOAD_CONFIG.SUPPORTED_FILE_TYPES.MIME_TYPES.includes(file.type as any);
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    const isValidExtension = VIDEO_UPLOAD_CONFIG.SUPPORTED_FILE_TYPES.EXTENSIONS.includes(fileExtension as any);
    
    if (!isValidMimeType && !isValidExtension) {
      const supportedFormats = VIDEO_UPLOAD_CONFIG.SUPPORTED_FILE_TYPES.EXTENSIONS.join(', ');
      setFileTypeError(`Unsupported file format! Please upload a video file. Supported formats: ${supportedFormats}`);
      return false;
    }
    
    setFileTypeError("");
    return true;
  };

  const validateFileSize = (file: File): boolean => {
    if (file.size > VIDEO_UPLOAD_CONFIG.MAX_FILE_SIZE) {
      const maxSizeMB = Math.round(VIDEO_UPLOAD_CONFIG.MAX_FILE_SIZE / (1024 * 1024));
      const fileSizeMB = Math.round(file.size / (1024 * 1024));
      setFileSizeError(`File too large! Maximum size allowed is ${maxSizeMB}MB. Your file is ${fileSizeMB}MB.`);
      return false;
    }
    setFileSizeError("");
    return true;
  };

  const validateFile = (file: File): boolean => {
    // Clear previous errors
    setFileTypeError("");
    setFileSizeError("");
    
    // Validate file type first
    if (!validateFileType(file)) {
      return false;
    }
    
    // Then validate file size
    if (!validateFileSize(file)) {
      return false;
    }
    
    return true;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file
      if (!validateFile(file)) {
        // Clear the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setProgress(0);
      setStatus("");
      setCompletedFrames(0);
      setTotalFrames(0);
      setPortfolioId(null);
      
      // Set default portfolio name with current time
      const now = new Date();
      const defaultName = `Portfolio ${now.toLocaleString()}`;
      setPortfolioName(defaultName);
    }
  };

  const createPortfolio = async (videoName: string): Promise<number> => {
    const response = await fetch('/portfolio/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        name: videoName,
        portfolioId: 0 
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to create portfolio');
    }
    
    const data = await response.json();
    return data.portfolio_id;
  };

  const sendFrameToServer = async (frameData: string): Promise<number> => {
    const response = await fetch('/record/img', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ image: frameData })
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    
    if (data.scan_id) {
      return data.scan_id;
    }
    
    throw new Error('No scan ID returned from server');
  };

  const addScanToPortfolio = async (portfolioId: number, scanId: number) => {
    const response = await fetch('/portfolio/add_scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        portfolioId,
        scanId 
      })
    });
    
    if (!response.ok) {
      console.warn(`Failed to add scan ${scanId} to portfolio ${portfolioId}`);
    }
  };

  const extractFrameAtTime = useCallback((video: HTMLVideoElement, time: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        reject(new Error('Canvas not available'));
        return;
      }

      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw the frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Get frame as base64 with quality based on processing mode
        const quality = processingMode === 'fast' 
          ? VIDEO_UPLOAD_CONFIG.PROCESSING.FAST_MODE.JPEG_QUALITY 
          : VIDEO_UPLOAD_CONFIG.PROCESSING.NORMAL_MODE.JPEG_QUALITY;
        const frameData = canvas.toDataURL('image/jpeg', quality).split(',')[1];
        resolve(frameData);
      };

      video.addEventListener('seeked', onSeeked);
      video.currentTime = time;
    });
  }, [processingMode]);

  // Fast frame selection using simplified quality metric
  const selectBestFrames = (frames: string[], topN: number = VIDEO_UPLOAD_CONFIG.PROCESSING.BEST_FRAMES_PER_SECOND): string[] => {
    const scored = frames.map(frame => ({
      frame,
      score: calculateSimpleQuality(frame)
    }));
    
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topN).map(item => item.frame);
  };

  // Process multiple seconds in parallel (for fast mode)
  const processSecondsBatch = async (
    video: HTMLVideoElement, 
    startSecond: number, 
    endSecond: number, 
    newPortfolioId: number,
    progressCallback: (completed: number) => void
  ) => {
    const batchPromises: Promise<void>[] = [];
    
    for (let second = startSecond; second < endSecond; second++) {
      const promise = processSecond(video, second, newPortfolioId, progressCallback);
      batchPromises.push(promise);
    }
    
    await Promise.all(batchPromises);
  };

  const processSecond = async (
    video: HTMLVideoElement, 
    second: number, 
    newPortfolioId: number,
    progressCallback: (completed: number) => void
  ) => {
    try {
      // Different parameters based on processing mode
      const modeConfig = processingMode === 'fast' 
        ? VIDEO_UPLOAD_CONFIG.PROCESSING.FAST_MODE 
        : VIDEO_UPLOAD_CONFIG.PROCESSING.NORMAL_MODE;
      
      const framesPerSecond = modeConfig.FRAMES_PER_SECOND;
      const bestFramesPerSecond = VIDEO_UPLOAD_CONFIG.PROCESSING.BEST_FRAMES_PER_SECOND;
      
      const frameTimes: number[] = [];
      for (let i = 0; i < framesPerSecond; i++) {
        frameTimes.push(second + (i / framesPerSecond));
      }
      
      const frames: string[] = [];
      for (const time of frameTimes) {
        try {
          const frame = await extractFrameAtTime(video, Math.min(time, video.duration - 0.1));
          frames.push(frame);
        } catch (error) {
          console.warn(`Failed to extract frame at ${time}:`, error);
        }
      }
      
      if (frames.length === 0) return;
      
      // Use different quality selection based on mode
      let bestFrames: string[];
      if (processingMode === 'fast') {
        bestFrames = selectBestFrames(frames, bestFramesPerSecond);
      } else {
        // Use the more sophisticated quality analysis for normal mode
        const topFrames = await getTopFramesFromBase64(frames, bestFramesPerSecond);
        bestFrames = topFrames.map(frame => frame.base64);
      }
      
      // Send frames to server with different delays based on mode
      const delay = modeConfig.DELAY_BETWEEN_REQUESTS;
      
      for (const frame of bestFrames) {
        try {
          const scanId = await sendFrameToServer(frame);
          await addScanToPortfolio(newPortfolioId, scanId);
          progressCallback(1);
        } catch (error) {
          console.warn(`Failed to process frame:`, error);
          progressCallback(1); // Still count for progress
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.warn(`Failed to process second ${second}:`, error);
      progressCallback(VIDEO_UPLOAD_CONFIG.PROCESSING.BEST_FRAMES_PER_SECOND); // Count all frames as processed
    }
  };

  // Sequential processing for normal mode
  const processVideoSequential = async (
    video: HTMLVideoElement,
    totalSeconds: number,
    newPortfolioId: number,
    progressCallback: (completed: number) => void
  ) => {
    for (let second = 0; second < totalSeconds; second++) {
      setStatus(`Processing second ${second + 1} of ${totalSeconds} (Normal Quality)...`);
      await processSecond(video, second, newPortfolioId, progressCallback);
    }
  };

  const processVideo = async () => {
    if (!selectedFile || !videoRef.current || !portfolioName.trim()) return;

    setIsProcessing(true);
    setStatus("Creating portfolio...");
    
    try {
      const video = videoRef.current;
      
      // Wait for video metadata to load
      await new Promise<void>((resolve, reject) => {
        const onLoadedMetadata = () => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          resolve();
        };
        
        video.addEventListener('loadedmetadata', onLoadedMetadata);
        
        if (video.readyState >= 1) {
          resolve();
        }
        
        setTimeout(() => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          reject(new Error('Video metadata load timeout'));
        }, VIDEO_UPLOAD_CONFIG.TIMEOUTS.VIDEO_METADATA_LOAD);
      });

      const duration = video.duration;
      const totalSeconds = Math.floor(duration);
      const bestFramesPerSecond = VIDEO_UPLOAD_CONFIG.PROCESSING.BEST_FRAMES_PER_SECOND;
      
      setTotalFrames(totalSeconds * bestFramesPerSecond);
      
      // Create portfolio with custom name
      const newPortfolioId = await createPortfolio(portfolioName.trim());
      setPortfolioId(newPortfolioId);
      
      const modeText = processingMode === 'fast' ? 'Fast Mode ⚡' : 'Normal Mode 🔍';
      setStatus(`Processing video frames (${modeText})...`);
      
      let completedCount = 0;
      const progressCallback = (increment: number) => {
        completedCount += increment;
        setCompletedFrames(completedCount);
        setProgress((completedCount / (totalSeconds * bestFramesPerSecond)) * 100);
      };
      
      if (processingMode === 'fast') {
        // Process in batches for speed
        const batchSize = VIDEO_UPLOAD_CONFIG.PROCESSING.FAST_MODE.BATCH_SIZE;
        for (let i = 0; i < totalSeconds; i += batchSize) {
          const endSecond = Math.min(i + batchSize, totalSeconds);
          setStatus(`Processing seconds ${i + 1}-${endSecond} of ${totalSeconds} (Fast Mode ⚡)...`);
          
          await processSecondsBatch(video, i, endSecond, newPortfolioId, progressCallback);
        }
      } else {
        // Sequential processing for normal mode (higher quality)
        await processVideoSequential(video, totalSeconds, newPortfolioId, progressCallback);
      }
      
      setStatus("Processing complete!");
      setProgress(100);
      
      // Auto-remove video after successful processing
      setTimeout(() => {
        if (videoUrl) {
          URL.revokeObjectURL(videoUrl);
        }
        setSelectedFile(null);
        setVideoUrl("");
        setProgress(0);
        setCompletedFrames(0);
        setTotalFrames(0);
        setPortfolioName("");
        setStatus("Video processed and removed successfully!");
      }, VIDEO_UPLOAD_CONFIG.TIMEOUTS.AUTO_REMOVE_VIDEO);
      
    } catch (error) {
      console.error('Error processing video:', error);
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      
      // Validate file
      if (!validateFile(file)) {
        return;
      }

      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setProgress(0);
      setStatus("");
      setCompletedFrames(0);
      setTotalFrames(0);
      setPortfolioId(null);
      
      // Set default portfolio name with current time
      const now = new Date();
      const defaultName = `Portfolio ${now.toLocaleString()}`;
      setPortfolioName(defaultName);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleRemoveVideo = () => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setSelectedFile(null);
    setVideoUrl("");
    setProgress(0);
    setStatus("");
    setCompletedFrames(0);
    setTotalFrames(0);
    setPortfolioId(null);
    setPortfolioName("");
    setFileSizeError("");
    setFileTypeError("");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">Upload Video</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* File Upload Area */}
          {!selectedFile && (
            <div
              className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-accent transition-colors cursor-pointer"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={48} className="mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium text-foreground mb-2">
                Drop your video here or click to browse
              </p>
              <p className="text-muted-foreground mb-2">
                Supports: {VIDEO_UPLOAD_CONFIG.SUPPORTED_FILE_TYPES.EXTENSIONS.join(', ')}
              </p>
              <p className="text-sm text-muted-foreground">
                Maximum file size: {Math.round(VIDEO_UPLOAD_CONFIG.MAX_FILE_SIZE / (1024 * 1024))}MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={VIDEO_UPLOAD_CONFIG.SUPPORTED_FILE_TYPES.MIME_TYPES.join(',')}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* File Type Error */}
          {fileTypeError && (
            <div className="flex items-center space-x-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle size={20} className="text-red-400" />
              <span className="text-red-400">{fileTypeError}</span>
            </div>
          )}

          {/* File Size Error */}
          {fileSizeError && (
            <div className="flex items-center space-x-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle size={20} className="text-red-400" />
              <span className="text-red-400">{fileSizeError}</span>
            </div>
          )}

          {/* Video Preview */}
          {selectedFile && (
            <div className="space-y-4">
              <div className="bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="w-full max-h-64 object-contain"
                  preload="metadata"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    <span className="text-green-400 ml-2">✓ Valid Format & Size</span>
                  </p>
                </div>
                
                <button
                  onClick={handleRemoveVideo}
                  className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-red-600 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          {/* Portfolio Name Input */}
          {selectedFile && !isProcessing && (
            <div className="space-y-2">
              <label htmlFor="portfolioName" className="block text-sm font-medium text-foreground">
                Portfolio Name
              </label>
              <input
                id="portfolioName"
                type="text"
                value={portfolioName}
                onChange={(e) => setPortfolioName(e.target.value)}
                placeholder="Enter portfolio name..."
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder-muted-foreground"
                disabled={isProcessing}
              />
              <p className="text-xs text-muted-foreground">
                This will be the name of the portfolio containing all extracted frames
              </p>
            </div>
          )}

          {/* Processing Mode Selection */}
          {selectedFile && !isProcessing && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground">Processing Mode</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Fast Mode */}
                <div 
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    processingMode === 'fast' 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover:border-accent'
                  }`}
                  onClick={() => setProcessingMode('fast')}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      processingMode === 'fast' ? 'border-primary bg-primary' : 'border-border'
                    }`} />
                    <Zap size={20} className="text-primary" />
                    <div>
                      <div className="font-medium text-foreground">Fast Mode</div>
                      <div className="text-sm text-muted-foreground">
                        4x faster • 4 frames/sec • Simplified quality analysis
                      </div>
                    </div>
                  </div>
                </div>

                {/* Normal Mode */}
                <div 
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    processingMode === 'normal' 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover:border-accent'
                  }`}
                  onClick={() => setProcessingMode('normal')}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      processingMode === 'normal' ? 'border-primary bg-primary' : 'border-border'
                    }`} />
                    <Clock size={20} className="text-blue-500" />
                    <div>
                      <div className="font-medium text-foreground">Normal Mode</div>
                      <div className="text-sm text-muted-foreground">
                        Higher quality • 8 frames/sec • Advanced quality analysis
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Processing Status */}
          {isProcessing && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                <span className="text-foreground">{status}</span>
              </div>
              
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              <div className="text-sm text-muted-foreground">
                Processed {completedFrames} of {totalFrames} best frames ({Math.round(progress)}%)
                {processingMode === 'fast' && ' - Fast Mode ⚡'}
                {processingMode === 'normal' && ' - Normal Mode 🔍'}
              </div>
            </div>
          )}

          {/* Success Message */}
          {portfolioId && !isProcessing && progress === 100 && (
            <div className="flex items-center space-x-2 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <CheckCircle size={20} className="text-green-400" />
              <span className="text-green-400">
                Video processed successfully! Portfolio "{portfolioName}" created.
              </span>
            </div>
          )}

          {/* Auto-removal notification */}
          {!selectedFile && !isProcessing && status.includes("removed successfully") && (
            <div className="flex items-center space-x-2 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <CheckCircle size={20} className="text-blue-400" />
              <span className="text-blue-400">{status}</span>
            </div>
          )}

          {/* Error Message */}
          {status.startsWith('Error:') && (
            <div className="flex items-center space-x-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle size={20} className="text-red-400" />
              <span className="text-red-400">{status}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-4 p-6 border-t border-border">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={processVideo}
            disabled={!selectedFile || isProcessing || !portfolioName.trim()}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
              !selectedFile || isProcessing || !portfolioName.trim()
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            {isProcessing ? 'Processing...' : `Process Video (${processingMode === 'fast' ? 'Fast ⚡' : 'Normal 🔍'})`}
          </button>
        </div>

        {/* Hidden canvas for frame extraction */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default VideoUpload; 