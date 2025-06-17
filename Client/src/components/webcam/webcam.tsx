import React, { useState, useEffect, useCallback, useRef } from "react";
import Webcam from "react-webcam";
import { ZoomIn, ZoomOut, Maximize, Minimize, Focus, Settings, RotateCcw, Camera, RefreshCw, X } from "lucide-react";
import { getFilterStyle, processImage } from "@/lib/image-processing";
import type { QualityLevel } from "@/lib/image-processing";
import { getTopImages } from "@/lib/getTopImages";
import { CAMERA_CONFIG } from "@/config/camera";

// No need for custom interface as we're using 'any' type for constraints
// to bypass TypeScript limitations with the browser APIs

const WebcamCapture: React.FC<{
  onCapture?: (imageSrc: string) => void;
  isRecording: boolean;
  onToggleRecording?: () => void;
  initialQuality?: QualityLevel;
}> = ({ onCapture, isRecording, onToggleRecording, initialQuality = "high" }) => {
  const webcamRef = useRef<Webcam>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<number | undefined>(undefined);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processedImageRef = useRef<string | null>(null);
  const lastCaptureTimeRef = useRef<number>(0);

  // Add new refs for image capture and scoring
  const capturedImagesRef = useRef<HTMLImageElement[]>([]);
  const captureIntervalRef = useRef<number | undefined>(undefined);
  const sendIntervalRef = useRef<number | undefined>(undefined);

  // Connect webcam ref to video element for processing
  useEffect(() => {
    if (webcamRef.current && webcamRef.current.video) {
      videoRef.current = webcamRef.current.video;
    }
  }, [webcamRef.current]);

  // State to track screen size for responsive behavior
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  // Listen for window resize to update mobile state
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Quality and enhancement settings
  const [quality, setQuality] = useState(initialQuality);
  const [enhancementLevel, setEnhancementLevel] = useState(3);
  const [sharpness, setSharpness] = useState(2);
  const [showSettings, setShowSettings] = useState(false);
  
  // Camera state
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [isLoadingCameras, setIsLoadingCameras] = useState(true);
  
  // Zoom state - now with optical zoom support
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [opticalZoomSupported, setOpticalZoomSupported] = useState(false);
  const [maxOpticalZoom, setMaxOpticalZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [autoFocus, setAutoFocus] = useState(true);
  
  // Get initial video constraints
  const getVideoConstraints = useCallback(() => {
    if (!isCameraActive) return false;
    
    const constraints: any = {
      width: { ideal: 3840 },
      height: { ideal: 2160 },
      aspectRatio: 16/9,
      frameRate: { ideal: 30, max: 60 },
    };

    if (selectedCameraId) {
      constraints.deviceId = selectedCameraId;
    } else {
      constraints.facingMode = facingMode;
    }

    if (opticalZoomSupported) {
      if (!constraints.advanced) {
        constraints.advanced = [];
      }
      constraints.advanced.push({ zoom: zoomLevel });
    }

    return constraints;
  }, [facingMode, selectedCameraId, zoomLevel, opticalZoomSupported, isCameraActive]);

  // Load available cameras
  const loadCameras = useCallback(async () => {
    setIsLoadingCameras(true);
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(videoDevices);
      
      if (videoDevices.length > 0 && !selectedCameraId) {
        const environmentCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('environment')
        );
        
        setSelectedCameraId(environmentCamera?.deviceId || videoDevices[0].deviceId);
      }
    } catch (error) {
      console.error("Error accessing media devices:", error);
    } finally {
      setIsLoadingCameras(false);
    }
  }, [selectedCameraId]);

  useEffect(() => {
    loadCameras();
  }, []);

  // Check for optical zoom capability when camera is connected
  useEffect(() => {
    const checkOpticalZoomCapability = async () => {
      if (!webcamRef.current?.video || !mediaStreamRef.current) return;

      try {
        const tracks = mediaStreamRef.current.getVideoTracks();
        if (tracks.length > 0) {
          const capabilities = tracks[0].getCapabilities();
          
          if (capabilities && 'zoom' in capabilities) {
            setOpticalZoomSupported(true);
            
            const zoomCapability = capabilities as any;
            const maxZoom = zoomCapability.zoom?.max || 10;
            setMaxOpticalZoom(maxZoom);
            console.log(`Optical zoom supported with max zoom: ${maxZoom}`);
          } else {
            setOpticalZoomSupported(false);
            console.log("Optical zoom not supported on this device");
          }
        }
      } catch (error) {
        console.error("Error checking zoom capabilities:", error);
        setOpticalZoomSupported(false);
      }
    };

    if (webcamRef.current) {
      webcamRef.current.video?.addEventListener('loadedmetadata', () => checkOpticalZoomCapability());
    }

    return () => {
      if (webcamRef.current) {
        webcamRef.current.video?.removeEventListener('loadedmetadata', () => checkOpticalZoomCapability());
      }
    };
  }, [webcamRef.current, mediaStreamRef.current]);

  // Apply optical zoom to camera when supported
  const applyOpticalZoom = useCallback(async (newZoomLevel: number) => {
    if (!mediaStreamRef.current || !opticalZoomSupported) return;

    try {
      const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
      if (!videoTrack) return;

      const constraints: any = {
        advanced: [{ zoom: newZoomLevel }]
      };

      await videoTrack.applyConstraints(constraints);
      console.log(`Applied optical zoom: ${newZoomLevel}`);
    } catch (error) {
      console.error("Error applying optical zoom:", error);
    }
  }, [mediaStreamRef.current, opticalZoomSupported]);

  // Calculate filter values based on quality settings
  const getFilterStyleForPreview = useCallback(() => {
    return getFilterStyle(quality, sharpness, enhancementLevel);
  }, [quality, sharpness, enhancementLevel]);

  // Function to capture and score an image
  const captureAndScoreImage = useCallback(() => {
    if (!webcamRef.current || !canvasRef.current || !videoRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { 
      alpha: false,
      willReadFrequently: true
    });
    if (!ctx) return;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn('Video not ready yet');
      return;
    }
    
    // Calculate target dimensions while maintaining aspect ratio
    const maxDimension = CAMERA_CONFIG.MAX_IMAGE_DIMENSION;
    let targetWidth = video.videoWidth;
    let targetHeight = video.videoHeight;
    
    if (targetWidth > maxDimension || targetHeight > maxDimension) {
      if (targetWidth > targetHeight) {
        targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
        targetWidth = maxDimension;
      } else {
        targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
        targetHeight = maxDimension;
      }
    }
    
    // Set canvas dimensions
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    
    // Enable image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw the video frame
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    
    // Process the image with enhancements
    processImage(
      ctx,
      targetWidth,
      targetHeight,
      quality,
      sharpness,
      enhancementLevel,
      zoomLevel,
      position,
      opticalZoomSupported
    );
    
    // Create a new image element and set its source
    const img = new Image();
    img.src = canvas.toDataURL('image/jpeg', CAMERA_CONFIG.JPEG_QUALITY);
    
    // Add to captured images array
    capturedImagesRef.current.push(img);
    
    // Keep only the last N images to prevent memory issues
    if (capturedImagesRef.current.length > CAMERA_CONFIG.MAX_STORED_IMAGES) {
      capturedImagesRef.current.shift();
    }
  }, [webcamRef, canvasRef, videoRef, quality, sharpness, enhancementLevel, zoomLevel, position, opticalZoomSupported]);

  // Function to send top images
  const sendTopImages = useCallback(() => {
    if (!onCapture || capturedImagesRef.current.length === 0) return;

    // Wait for all images to load
    const loadedImages = capturedImagesRef.current.filter(img => img.complete);
    if (loadedImages.length === 0) return;

    // Get top N images using the scoring function
    const topImages = getTopImages(loadedImages, CAMERA_CONFIG.TOP_IMAGES_TO_SEND);
    
    // Send each top image
    topImages.forEach((img: HTMLImageElement) => {
      if (onCapture) {
        onCapture(img.src);
      }
    });

    // Clear the captured images array
    capturedImagesRef.current = [];
  }, [onCapture]);

  // Handle recording interval
  useEffect(() => {
    if (isRecording) {
      // Start capturing images at configured interval
      captureIntervalRef.current = window.setInterval(captureAndScoreImage, CAMERA_CONFIG.CAPTURE_INTERVAL_MS);
      
      // Start sending top images at configured interval
      sendIntervalRef.current = window.setInterval(sendTopImages, CAMERA_CONFIG.SEND_INTERVAL_MS);
    } else {
      // Clear intervals
      if (captureIntervalRef.current) {
        window.clearInterval(captureIntervalRef.current);
      }
      if (sendIntervalRef.current) {
        window.clearInterval(sendIntervalRef.current);
      }
      // Clear captured images
      capturedImagesRef.current = [];
    }

    return () => {
      if (captureIntervalRef.current) {
        window.clearInterval(captureIntervalRef.current);
      }
      if (sendIntervalRef.current) {
        window.clearInterval(sendIntervalRef.current);
      }
    };
  }, [isRecording, captureAndScoreImage, sendTopImages]);

  // Add event listeners for mouse movements outside the component
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };
    
    if (isDragging) {
      window.addEventListener('mouseup', handleGlobalMouseUp);
      window.addEventListener('mouseleave', handleGlobalMouseUp);
    }
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mouseleave', handleGlobalMouseUp);
    };
  }, [isDragging]);

  // Handle zooming in with limits
  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel + 0.125, opticalZoomSupported ? maxOpticalZoom : 4);
    setZoomLevel(newZoom);
    
    if (opticalZoomSupported) {
      applyOpticalZoom(newZoom);
    }
  };

  // Handle zooming out with limits
  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const newZoom = Math.max(prev - 0.25, 1);
      
      if (newZoom === 1 && !opticalZoomSupported) {
        setPosition({ x: 0, y: 0 });
      }
      
      if (opticalZoomSupported) {
        applyOpticalZoom(newZoom);
      }
      
      return newZoom;
    });
  };

  // Reset zoom to default
  const handleResetZoom = () => {
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
    
    if (opticalZoomSupported) {
      applyOpticalZoom(1);
    }
  };

  const handleResetCamera = () => {
    handleResetZoom();
    setPosition({ x: 0, y: 0 });
  };

  // Maximize zoom
  const handleMaxZoom = () => {
    const maxZoom = opticalZoomSupported ? maxOpticalZoom : 4;
    setZoomLevel(maxZoom);
    
    if (opticalZoomSupported) {
      applyOpticalZoom(maxZoom);
    }
  };

  // Toggle camera on/off
  const toggleCameraActive = () => {
    if (isCameraActive) {
      // Stop the camera
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      setIsCameraActive(false);
      // Also stop recording if active
      if (isRecording && onToggleRecording) {
        onToggleRecording();
      }
    } else {
      // Restart the camera
      setIsCameraActive(true);
    }
  };

  // Toggle camera between front and back
  const toggleCamera = () => {
    const newFacingMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newFacingMode);
    setSelectedCameraId("");
    handleResetCamera();
  };

  // Select a specific camera by ID
  const selectCamera = (deviceId: string) => {
    setSelectedCameraId(deviceId);
    handleResetCamera();
  };

  // Refresh camera list
  const refreshCameras = () => {
    loadCameras();
  };

  // Start dragging to pan the zoomed view
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1 && !opticalZoomSupported) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  // Update position while dragging
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || opticalZoomSupported) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    setPosition(prev => {
      const maxOffset = (zoomLevel - 1) * 100;
      const newX = Math.max(Math.min(prev.x + deltaX, maxOffset), -maxOffset);
      const newY = Math.max(Math.min(prev.y + deltaY, maxOffset), -maxOffset);
      
      return { x: newX, y: newY };
    });
    
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // Stop dragging
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Toggle autofocus
  const toggleAutoFocus = () => {
    const newAutoFocus = !autoFocus;
    setAutoFocus(newAutoFocus);
    
    if (mediaStreamRef.current) {
      try {
        const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
        if (!videoTrack) return;
        
        const constraints: any = {
          advanced: [{ 
            focusMode: newAutoFocus ? 'continuous' : 'manual'
          }]
        };
        
        videoTrack.applyConstraints(constraints)
          .catch(err => {
            console.log("Could not set focus mode, trying alternative method");
            
            const altConstraints: any = {
              advanced: [{ 
                focus: newAutoFocus ? 'continuous' : 'manual'
              }]
            };
            
            return videoTrack.applyConstraints(altConstraints);
          })
          .catch(err => {
            console.log("Focus control not supported on this device");
          });
      } catch (error) {
        console.error("Error toggling autofocus:", error);
      }
    }
  };
  
  // Toggle settings panel
  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };
  
  // Handle quality change
  const changeQuality = (newQuality: QualityLevel) => {
    setQuality(newQuality);
  };

  return (
    <div className={`relative w-full overflow-hidden ${isMobile ? 'h-screen max-h-screen' : 'h-screen'}`}>
      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Main camera view - optimized for mobile */}
      <div 
        ref={containerRef}
        className={`absolute inset-0 w-full ${isMobile ? 'h-full' : 'h-full'}`}
        style={{ 
          cursor: (zoomLevel > 1 && !opticalZoomSupported) ? 'move' : 'default',
          // On mobile, account for the bottom controls by reducing height
          height: isMobile ? 'calc(100vh - 120px)' : '100%'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Top overlay indicators */}
        <div className={`absolute ${isMobile ? 'top-2 left-2 right-2' : 'top-4 left-4 right-4'} flex justify-between items-start z-30 pointer-events-none`}>
          {/* Quality indicator */}
          <div className={`bg-black/70 text-white ${isMobile ? 'px-2 py-1 text-xs' : 'px-3 py-1 text-sm'} rounded-full font-medium backdrop-blur-sm`}>
            {quality === "ultra" ? "ULTRA HD" : quality === "high" ? "HD" : "Standard"}
          </div>
          
          {/* Empty space for balance */}
          <div></div>
        </div>
        
        {/* Camera controls - top right - compact on mobile */}
        <div className={`absolute ${isMobile ? 'top-2 right-2' : 'top-4 right-4'} flex space-x-1 z-40`}>
          <button 
            onClick={toggleCamera}
            className={`${isMobile ? 'p-2' : 'p-3'} rounded-full bg-black/70 text-white hover:bg-black/80 backdrop-blur-sm transition-all`}
            title="Switch Camera"
          >
            <RefreshCw size={isMobile ? 16 : 20} />
          </button>
          
          <button 
            onClick={toggleSettings}
            className={`${isMobile ? 'p-2' : 'p-3'} rounded-full backdrop-blur-sm transition-all ${
              showSettings 
                ? 'bg-blue-500 text-white' 
                : 'bg-black/70 text-white hover:bg-black/80'
            }`}
            title="Settings"
          >
            <Settings size={isMobile ? 16 : 20} />
          </button>
        </div>
        
        {/* Camera indicator - positioned to avoid extra space */}
        {isCameraActive && (
          <div className={`absolute ${isMobile ? 'bottom-2 left-2' : 'bottom-2 left-4'} bg-black/70 text-white ${isMobile ? 'px-2 py-1 text-xs' : 'px-3 py-1 text-sm'} rounded-full font-medium z-30 backdrop-blur-sm pointer-events-none`}>
            {facingMode === "environment" ? "Rear Camera" : "Front Camera"}
          </div>
        )}
        
        <div
          style={{
            transform: opticalZoomSupported 
              ? 'none' 
              : `scale(${zoomLevel}) translate(${position.x / zoomLevel}px, ${position.y / zoomLevel}px)`,
            transformOrigin: 'center',
            transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            width: '100%',
            height: '100%',
            filter: getFilterStyleForPreview()
          }}
        >
          {isCameraActive ? (
            <Webcam
              audio={false}
              width={3840}
              height={2160}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={getVideoConstraints()}
              imageSmoothing={true}
              className="w-full h-full object-cover"
              forceScreenshotSourceSize
              onUserMedia={(stream) => {
                mediaStreamRef.current = stream;
              }}
            />
          ) : (
            <div className="w-full h-full bg-black flex items-center justify-center">
              <div className="text-center text-white">
                <Camera size={64} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Camera Stopped</p>
                <p className="text-sm opacity-70">Press START to resume</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Zoom focus indicator - only for digital zoom */}
        {zoomLevel > 1 && !opticalZoomSupported && (
          <div className="absolute inset-0 pointer-events-none z-20">
            <div className={`${isMobile ? 'w-16 h-16' : 'w-24 h-24'} border-2 border-white border-opacity-70 rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2`} />
            <div className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} border border-white border-opacity-70 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center`}>
              <div className={`w-1 ${isMobile ? 'h-6' : 'h-8'} bg-white bg-opacity-70`} />
              <div className={`${isMobile ? 'w-6' : 'w-8'} h-1 bg-white bg-opacity-70 absolute`} />
            </div>
          </div>
        )}
      </div>
      
      {/* Fixed bottom controls bar - comprehensive mobile controls */}
      <div className={`fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-md border-t border-white/20 z-40`}>
        {/* Two-row layout for mobile to fit all controls */}
        {isMobile ? (
          <div className="space-y-2 p-3">
            {/* Top row - Main controls */}
            <div className="flex items-center justify-center">
              {/* Central camera control button */}
              <button 
                onClick={toggleCameraActive}
                className={`px-6 py-3 rounded-full font-semibold text-sm transition-all ${
                  isCameraActive 
                    ? 'bg-red-500 text-white hover:bg-red-600' 
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
                title={isCameraActive ? "Stop Camera" : "Start Camera"}
              >
                {isCameraActive ? '⏹ STOP' : '▶ START'}
              </button>
            </div>

            {/* Bottom row - Zoom controls */}
            <div className="flex items-center justify-center space-x-2">
              <button 
                onClick={handleResetZoom}
                className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-all"
                title="Reset Zoom"
              >
                <Minimize size={16} />
              </button>

              <button 
                onClick={handleZoomOut}
                disabled={zoomLevel <= 1}
                className={`p-2 rounded-full transition-all ${
                  zoomLevel <= 1 
                    ? 'bg-white/10 text-white/40' 
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              
              <div className="min-w-14 text-center">
                <span className="text-white font-medium text-sm">{Math.round(zoomLevel * 100)}%</span>
              </div>
              
              <button 
                onClick={handleZoomIn}
                disabled={zoomLevel >= (opticalZoomSupported ? maxOpticalZoom : 4)}
                className={`p-2 rounded-full transition-all ${
                  zoomLevel >= (opticalZoomSupported ? maxOpticalZoom : 4)
                    ? 'bg-white/10 text-white/40' 
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
              
              <button 
                onClick={handleMaxZoom}
                className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-all"
                title="Maximum Zoom"
              >
                <Maximize size={16} />
              </button>
            </div>
          </div>
        ) : (
          /* Desktop single-row layout */
          <div className="flex items-center justify-center space-x-4 p-4">
            {/* Zoom controls */}
            <button 
              onClick={handleResetZoom}
              className="p-3 rounded-full bg-white/20 text-white hover:bg-white/30 transition-all"
              title="Reset Zoom"
            >
              <Minimize size={20} />
            </button>

            <button 
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
              className={`p-3 rounded-full transition-all ${
                zoomLevel <= 1 
                  ? 'bg-white/10 text-white/40' 
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              title="Zoom Out"
            >
              <ZoomOut size={20} />
            </button>
            
            <div className="min-w-20 text-center">
              <span className="text-white font-medium text-lg">{Math.round(zoomLevel * 100)}%</span>
            </div>
            
            <button 
              onClick={handleZoomIn}
              disabled={zoomLevel >= (opticalZoomSupported ? maxOpticalZoom : 4)}
              className={`p-3 rounded-full transition-all ${
                zoomLevel >= (opticalZoomSupported ? maxOpticalZoom : 4)
                  ? 'bg-white/10 text-white/40' 
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              title="Zoom In"
            >
              <ZoomIn size={20} />
            </button>
            
            <button 
              onClick={handleMaxZoom}
              className="p-3 rounded-full bg-white/20 text-white hover:bg-white/30 transition-all"
              title="Maximum Zoom"
            >
              <Maximize size={20} />
            </button>

            {/* Camera control button */}
            <button 
              onClick={toggleCameraActive}
              className={`px-6 py-3 rounded-full font-semibold transition-all ${
                isCameraActive 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
              title={isCameraActive ? "Stop Camera" : "Start Camera"}
            >
              {isCameraActive ? '⏹ STOP' : '▶ START'}
            </button>
          </div>
        )}
      </div>
      
      {/* Mobile-optimized slide-out settings panel */}
      <div 
        className={`fixed top-0 right-0 h-full ${isMobile ? 'w-full' : 'w-80'} bg-black/95 backdrop-blur-xl border-l border-white/20 transform transition-transform duration-300 ease-out z-50 ${
          showSettings ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Settings header */}
        <div className={`flex items-center justify-between ${isMobile ? 'p-3' : 'p-4'} border-b border-white/20`}>
          <h3 className={`text-white ${isMobile ? 'text-base' : 'text-lg'} font-semibold`}>Camera Settings</h3>
          <button 
            onClick={toggleSettings}
            className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-all"
          >
            <X size={isMobile ? 18 : 20} />
          </button>
        </div>
        
        {/* Settings content - scrollable */}
        <div className={`h-full overflow-y-auto pb-20 ${isMobile ? 'p-3' : 'p-4'} space-y-4`}>
          
          {/* Camera selection */}
          {availableCameras.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className={`block text-white font-medium ${isMobile ? 'text-sm' : ''}`}>Camera</label>
                <button 
                  onClick={refreshCameras}
                  className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-all"
                  title="Refresh Camera List"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
              <select 
                value={selectedCameraId}
                onChange={(e) => selectCamera(e.target.value)}
                className={`block w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm ${isMobile ? 'text-sm' : ''}`}
              >
                <option value="" className="bg-black/90">Auto ({facingMode === "environment" ? "Rear" : "Front"})</option>
                {availableCameras.map((camera) => (
                  <option key={camera.deviceId} value={camera.deviceId} className="bg-black/90">
                    {camera.label || `Camera ${camera.deviceId.substring(0, 5)}...`}
                  </option>
                ))}
              </select>
              <div className={`text-white/70 ${isMobile ? 'text-xs' : 'text-sm'} mt-2`}>
                Available: {availableCameras.length} camera{availableCameras.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}
          
          {/* Quality selection */}
          <div>
            <label className={`block text-white font-medium mb-3 ${isMobile ? 'text-sm' : ''}`}>Image Quality</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => changeQuality("standard")}
                className={`px-3 py-2 rounded-lg ${isMobile ? 'text-xs' : 'text-sm'} font-medium transition-all ${
                  quality === "standard" 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                Standard
              </button>
              <button
                onClick={() => changeQuality("high")}
                className={`px-3 py-2 rounded-lg ${isMobile ? 'text-xs' : 'text-sm'} font-medium transition-all ${
                  quality === "high" 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                High
              </button>
              <button
                onClick={() => changeQuality("ultra")}
                className={`px-3 py-2 rounded-lg ${isMobile ? 'text-xs' : 'text-sm'} font-medium transition-all ${
                  quality === "ultra" 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                Ultra HD
              </button>
            </div>
          </div>
          
          {/* Enhancement level */}
          <div>
            <label className={`block text-white font-medium mb-3 ${isMobile ? 'text-sm' : ''}`}>
              Image Enhancement: {enhancementLevel}
            </label>
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max="5"
                value={enhancementLevel}
                onChange={(e) => setEnhancementLevel(parseInt(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className={`flex justify-between text-white/70 ${isMobile ? 'text-xs' : 'text-xs'}`}>
                <span>None</span>
                <span>Maximum</span>
              </div>
            </div>
          </div>
          
          {/* Sharpness level */}
          <div>
            <label className={`block text-white font-medium mb-3 ${isMobile ? 'text-sm' : ''}`}>
              Image Sharpness: {sharpness}
            </label>
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max="4"
                value={sharpness}
                onChange={(e) => setSharpness(parseInt(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className={`flex justify-between text-white/70 ${isMobile ? 'text-xs' : 'text-xs'}`}>
                <span>None</span>
                <span>Sharp</span>
              </div>
            </div>
          </div>
          
          {/* Auto Focus section */}
          <div>
            <label className={`block text-white font-medium mb-3 ${isMobile ? 'text-sm' : ''}`}>Auto Focus</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAutoFocus(true)}
                className={`px-3 py-2 rounded-lg ${isMobile ? 'text-xs' : 'text-sm'} font-medium transition-all ${
                  autoFocus 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                On
              </button>
              <button
                onClick={() => setAutoFocus(false)}
                className={`px-3 py-2 rounded-lg ${isMobile ? 'text-xs' : 'text-sm'} font-medium transition-all ${
                  !autoFocus 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                Off
              </button>
            </div>
          </div>
          
          {/* Camera capabilities info */}
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <h4 className={`text-white font-medium mb-2 ${isMobile ? 'text-sm' : ''}`}>Camera Capabilities</h4>
            <div className={`text-white/70 ${isMobile ? 'text-xs' : 'text-sm'} space-y-1`}>
              <div>Optical Zoom: {opticalZoomSupported ? `✅ Up to ${maxOpticalZoom}x` : "❌ Not supported"}</div>
              <div>Digital Zoom: ✅ Up to 4x</div>
              <div>Auto Focus: {autoFocus ? "✅ Enabled" : "❌ Disabled"}</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Background overlay when settings open */}
      {showSettings && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={toggleSettings}
        />
      )}
    </div>
  );
};

export default WebcamCapture;