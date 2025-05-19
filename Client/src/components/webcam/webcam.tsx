import React, { useState, useEffect, useCallback, useRef } from "react";
import Webcam from "react-webcam";
import { ZoomIn, ZoomOut, Maximize, Minimize, Focus, Settings, RotateCcw, Camera, RefreshCw } from "lucide-react";
import { getFilterStyle, processImage } from "@/lib/image-processing";
import type { QualityLevel } from "@/lib/image-processing";

// No need for custom interface as we're using 'any' type for constraints
// to bypass TypeScript limitations with the browser APIs

const WebcamCapture: React.FC<{
  onCapture?: (imageSrc: string) => void;
  isRecording: boolean;
  initialQuality?: QualityLevel;
}> = ({ onCapture, isRecording, initialQuality = "high" }) => {
  const webcamRef = useRef<Webcam>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<number | undefined>(undefined);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processedImageRef = useRef<string | null>(null);
  const lastCaptureTimeRef = useRef<number>(0);

  // Connect webcam ref to video element for processing
  useEffect(() => {
    if (webcamRef.current && webcamRef.current.video) {
      videoRef.current = webcamRef.current.video;
    }
  }, [webcamRef.current]);
  
  // Quality and enhancement settings
  const [quality, setQuality] = useState(initialQuality);
  const [enhancementLevel, setEnhancementLevel] = useState(3);
  const [sharpness, setSharpness] = useState(2);
  const [showSettings, setShowSettings] = useState(false);
  
  // Camera state
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
    const constraints: any = {
      width: { ideal: 3840 }, // 4K resolution for maximum quality when zooming
      height: { ideal: 2160 },
      aspectRatio: 16/9,
      frameRate: { ideal: 30, max: 60 },
    };

    // Add device ID if we have one selected
    if (selectedCameraId) {
      constraints.deviceId = selectedCameraId;
    } else {
      constraints.facingMode = facingMode;
    }

    // Try to add optical zoom if supported
    if (opticalZoomSupported) {
      if (!constraints.advanced) {
        constraints.advanced = [];
      }
      constraints.advanced.push({ zoom: zoomLevel });
    }

    return constraints;
  }, [facingMode, selectedCameraId, zoomLevel, opticalZoomSupported]);

  // Load available cameras
  const loadCameras = useCallback(async () => {
    setIsLoadingCameras(true);
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(videoDevices);
      
      // If we found cameras and don't have one selected, pick the first
      if (videoDevices.length > 0 && !selectedCameraId) {
        // Try to find the environment camera first
        const environmentCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('environment')
        );
        
        // If we found an environment camera, use it, otherwise use the first camera
        setSelectedCameraId(environmentCamera?.deviceId || videoDevices[0].deviceId);
      }
    } catch (error) {
      console.error("Error accessing media devices:", error);
    } finally {
      setIsLoadingCameras(false);
    }
  }, [selectedCameraId]);

  // Immediately check for available cameras on component mount
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
          
          // Check if zoom capability exists and get its range
          if (capabilities && 'zoom' in capabilities) {
            setOpticalZoomSupported(true);
            
            // Access zoom capability max value (with type safety)
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

      // Use any type to bypass TypeScript restrictions since the constraint is supported by browsers
      const constraints: any = {
        advanced: [{ zoom: newZoomLevel }]
      };

      // Apply the new constraints to the track
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

  // Enhanced capture with post-processing for quality
  const capture = useCallback(() => {
    if (!webcamRef.current || !canvasRef.current || !videoRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { 
      alpha: false,
      willReadFrequently: true  // Add this for better performance when reading canvas data
    });
    if (!ctx) return;

    // Wait for video to be ready
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn('Video not ready yet');
      return;
    }
    
    // Calculate target dimensions while maintaining aspect ratio
    const maxDimension = 2000; // Maximum width or height
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
    
    // Set canvas dimensions to target size
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    
    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw the video frame at target size
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    
    // Process the image with all enhancements
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
    
    // Get the enhanced image with good quality from the processed context
    const imageSrc = canvas.toDataURL('image/jpeg', 0.95);
    processedImageRef.current = imageSrc;
  }, [webcamRef, canvasRef, videoRef, quality, sharpness, enhancementLevel, zoomLevel, position, opticalZoomSupported]);
  
  // Handle zooming in with limits
  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel + 0.25, opticalZoomSupported ? maxOpticalZoom : 4);
    setZoomLevel(newZoom);
    
    if (opticalZoomSupported) {
      applyOpticalZoom(newZoom);
    }
  };

  // Handle zooming out with limits
  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const newZoom = Math.max(prev - 0.25, 1);
      
      // Reset position if zooming back to 1 and not using optical zoom
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

  // Toggle camera between front and back
  const toggleCamera = () => {
    const newFacingMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newFacingMode);
    setSelectedCameraId(""); // Clear specific camera selection when toggling
    
    // Reset zoom when switching cameras
    handleResetCamera();
  };

  // Select a specific camera by ID
  const selectCamera = (deviceId: string) => {
    setSelectedCameraId(deviceId);
    
    // Reset zoom when switching cameras
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
      // Calculate bounds for panning
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

  // Handle recording interval
  useEffect(() => {
    if (isRecording) {
      // Capture immediately when recording starts
      capture();
      
      intervalRef.current = window.setInterval(() => {
        const now = Date.now();
        // Capture and send image every 750ms
        capture();
        if (processedImageRef.current && onCapture) {
          onCapture(processedImageRef.current);
          lastCaptureTimeRef.current = now;
        }
      }, 750);
    } else {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
      processedImageRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [isRecording, capture, onCapture]);

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

  // Toggle autofocus
  const toggleAutoFocus = () => {
    const newAutoFocus = !autoFocus;
    setAutoFocus(newAutoFocus);
    
    if (mediaStreamRef.current) {
      try {
        const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
        if (!videoTrack) return;
        
        // Cast to any to bypass TypeScript constraints since browser APIs 
        // support more capabilities than TypeScript types currently define
        const constraints: any = {
          advanced: [{ 
            focusMode: newAutoFocus ? 'continuous' : 'manual'
          }]
        };
        
        // Try to apply the constraints
        videoTrack.applyConstraints(constraints)
          .catch(err => {
            console.log("Could not set focus mode, trying alternative method");
            
            // Try alternative constraint name if first one fails
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
    <div className="space-y-4">
      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />
      
      <div 
        ref={containerRef}
        className="relative overflow-hidden rounded-lg shadow-lg"
        style={{ 
          width: '100%', 
          height: '720px',
          cursor: (zoomLevel > 1 && !opticalZoomSupported) ? 'move' : 'default'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Zoom indicator */}
        <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm font-medium z-10">
          {Math.round(zoomLevel * 100)}% {opticalZoomSupported ? '(Optical)' : ''}
        </div>
        
        {/* Camera controls */}
        <div className="absolute top-4 right-20 flex space-x-2 z-20">
          <button 
            onClick={toggleCamera}
            className="p-2 rounded-full bg-black/80 text-white hover:bg-black/90 backdrop-blur-sm"
            title="Switch Camera"
          >
            <RefreshCw size={20} />
          </button>
          
          <button 
            onClick={toggleSettings}
            className="p-2 rounded-full bg-black/80 text-white hover:bg-black/90 backdrop-blur-sm"
            title="Settings"
          >
            <Settings size={20} />
          </button>
        </div>
        
        {/* Quality indicator */}
        <div className="absolute top-4 right-4 bg-black/80 text-white px-3 py-1 rounded-full text-sm font-medium z-20 backdrop-blur-sm">
          {quality === "ultra" ? "ULTRA HD" : quality === "high" ? "HD" : "Standard"}
        </div>
        
        {/* Camera indicator */}
        <div className="absolute bottom-4 left-4 bg-black/80 text-white px-3 py-1 rounded-full text-sm font-medium z-20 backdrop-blur-sm">
          {facingMode === "environment" ? "Rear Camera" : "Front Camera"}
        </div>
        
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
        </div>
        
        {/* Zoom focus indicator - only for digital zoom */}
        {zoomLevel > 1 && !opticalZoomSupported && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="w-24 h-24 border-2 border-white border-opacity-70 rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            <div className="w-8 h-8 border border-white border-opacity-70 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
              <div className="w-1 h-8 bg-white bg-opacity-70" />
              <div className="w-8 h-1 bg-white bg-opacity-70 absolute" />
            </div>
          </div>
        )}
      </div>
      
      {/* Main controls - Zoom only */}
      <div className="flex items-center justify-center space-x-4 flex-wrap">
        <button 
          onClick={handleResetZoom}
          className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
          title="Reset Zoom"
        >
          <Minimize size={24} />
        </button>

        <button 
          onClick={handleZoomOut}
          disabled={zoomLevel <= 1}
          className={`p-2 rounded-full ${zoomLevel <= 1 ? 'bg-gray-200 text-gray-400' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
          title="Zoom Out"
        >
          <ZoomOut size={24} />
        </button>
        
        <div className="text-center min-w-20">
          <span className="font-medium text-gray-700">{Math.round(zoomLevel * 100)}%</span>
        </div>
        
        <button 
          onClick={handleZoomIn}
          disabled={zoomLevel >= (opticalZoomSupported ? maxOpticalZoom : 4)}
          className={`p-2 rounded-full ${zoomLevel >= (opticalZoomSupported ? maxOpticalZoom : 4) ? 'bg-gray-200 text-gray-400' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
          title="Zoom In"
        >
          <ZoomIn size={24} />
        </button>
        
        <button 
          onClick={handleMaxZoom}
          className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
          title="Maximum Zoom"
        >
          <Maximize size={24} />
        </button>
      </div>
      
      {/* Advanced settings panel */}
      {showSettings && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg shadow-lg">
          <h3 className="font-medium text-lg mb-3 text-green-400">Advanced Settings</h3>
          
          <div className="space-y-4">
            {/* Camera selection */}
            {availableCameras.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-green-400">Select Camera</label>
                  <button 
                    onClick={refreshCameras}
                    className="p-1 rounded-full bg-green-500/10 text-green-400 hover:bg-green-500/20"
                    title="Refresh Camera List"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
                <select 
                  value={selectedCameraId}
                  onChange={(e) => selectCamera(e.target.value)}
                  className="block w-full px-3 py-2 bg-black/80 border border-green-500/20 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 text-green-400 backdrop-blur-sm"
                >
                  <option value="" className="bg-black/90">Auto ({facingMode === "environment" ? "Rear" : "Front"})</option>
                  {availableCameras.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId} className="bg-black/90">
                      {camera.label || `Camera ${camera.deviceId.substring(0, 5)}...`}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-green-400/70 mt-1">
                  Available Cameras: {availableCameras.length}
                </div>
              </div>
            )}
            
            {/* Quality selection */}
            <div>
              <label className="block text-sm font-medium text-green-400 mb-1">Image Quality</label>
              <div className="flex space-x-2">
                <button
                  onClick={() => changeQuality("standard")}
                  className={`px-3 py-1 rounded ${quality === "standard" ? 'bg-green-500 text-white' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'}`}
                >
                  Standard
                </button>
                <button
                  onClick={() => changeQuality("high")}
                  className={`px-3 py-1 rounded ${quality === "high" ? 'bg-green-500 text-white' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'}`}
                >
                  High
                </button>
                <button
                  onClick={() => changeQuality("ultra")}
                  className={`px-3 py-1 rounded ${quality === "ultra" ? 'bg-green-500 text-white' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'}`}
                >
                  Ultra HD
                </button>
              </div>
            </div>
            
            {/* Enhancement level */}
            <div>
              <label className="block text-sm font-medium text-green-400 mb-1">
                Image Enhancement: {enhancementLevel}
              </label>
              <input
                type="range"
                min="0"
                max="5"
                value={enhancementLevel}
                onChange={(e) => setEnhancementLevel(parseInt(e.target.value))}
                className="w-full accent-green-500"
              />
              <div className="text-xs text-green-400/70 mt-1">
                0: No enhancement - 5: Maximum enhancement
              </div>
            </div>
            
            {/* Sharpness level */}
            <div>
              <label className="block text-sm font-medium text-green-400 mb-1">
                Image Sharpness: {sharpness}
              </label>
              <input
                type="range"
                min="0"
                max="4"
                value={sharpness}
                onChange={(e) => setSharpness(parseInt(e.target.value))}
                className="w-full accent-green-500"
              />
              <div className="text-xs text-green-400/70 mt-1">
                0: No sharpening - 4: Maximum sharpness
              </div>
            </div>
            
            {/* Auto Focus section */}
            <div>
              <label className="block text-sm font-medium text-green-400 mb-1">
                Auto Focus
              </label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setAutoFocus(true)}
                  className={`px-3 py-1 rounded ${autoFocus ? 'bg-green-500 text-white' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'}`}
                >
                  On
                </button>
                <button
                  onClick={() => setAutoFocus(false)}
                  className={`px-3 py-1 rounded ${!autoFocus ? 'bg-green-500 text-white' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'}`}
                >
                  Off
                </button>
              </div>
            </div>
            
            {/* Camera capabilities info */}
            <div className="text-sm text-green-400/70 mt-2 border-t border-green-500/20 pt-2">
              <div>Optical Zoom: {opticalZoomSupported ? `Supported (up to ${maxOpticalZoom}x)` : "Not supported"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebcamCapture;
