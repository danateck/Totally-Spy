import React, { useState, useEffect, useCallback, useRef } from "react";
import Webcam from "react-webcam";
import { ZoomIn, ZoomOut, Maximize, Minimize, Focus, Settings, RotateCcw, Camera, RefreshCw } from "lucide-react";

// No need for custom interface as we're using 'any' type for constraints
// to bypass TypeScript limitations with the browser APIs

const WebcamCapture: React.FC<{
  onCapture?: (imageSrc: string) => void;
  isRecording: boolean;
  initialQuality?: "standard" | "high" | "ultra"; // Quality presets
}> = ({ onCapture, isRecording, initialQuality = "high" }) => {
  const webcamRef = useRef<Webcam>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<number | undefined>(undefined);
  const mediaStreamRef = useRef<MediaStream | null>(null);

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
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
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
        setSelectedCameraId(videoDevices[0].deviceId);
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

    // Store media stream reference when available
    const handleUserMedia = (stream: MediaStream) => {
      mediaStreamRef.current = stream;
      checkOpticalZoomCapability();
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

  // Enhanced capture with post-processing for quality
  const capture = useCallback(() => {
    if (!webcamRef.current || !canvasRef.current || !videoRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Calculate zoomed dimensions and position
    const zoomedWidth = video.videoWidth / zoomLevel;
    const zoomedHeight = video.videoHeight / zoomLevel;
    
    // Calculate source rectangle for zoomed capture
    const sourceX = (video.videoWidth - zoomedWidth) / 2 - position.x;
    const sourceY = (video.videoHeight - zoomedHeight) / 2 - position.y;
    
    // Draw the zoomed portion of the video to canvas
    ctx.drawImage(
      video,
      sourceX, sourceY, zoomedWidth, zoomedHeight,  // Source rectangle
      0, 0, canvas.width, canvas.height            // Destination rectangle
    );
    
    // Apply enhancement based on current settings
    if (quality !== "standard") {
      // Apply sharpening filter for enhanced clarity
      applySharpening(ctx, canvas.width, canvas.height, sharpness);
      
      // Apply additional enhancements based on level
      if (quality === "ultra") {
        applyColorEnhancement(ctx, canvas.width, canvas.height, enhancementLevel);
      }
    }
    
    // Get the enhanced image
    const imageSrc = canvas.toDataURL('image/jpeg', 0.95);
    
    if (imageSrc && onCapture) {
      onCapture(imageSrc);
    }
  }, [webcamRef, canvasRef, videoRef, onCapture, quality, enhancementLevel, sharpness, zoomLevel, position]);
  
  // Apply sharpening filter to enhance details
  const applySharpening = (ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const factor = 0.25 * intensity;
    const bias = 128 * (1 - factor);
    
    // Simple sharpening algorithm
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    tempCtx.drawImage(ctx.canvas, 0, 0);
    const tempData = tempCtx.getImageData(0, 0, width, height).data;
    
    // Apply convolution filter
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const pos = (y * width + x) * 4;
        
        for (let i = 0; i < 3; i++) {
          const val = (
            -tempData[pos - width * 4 + i] -
            tempData[pos - 4 + i] +
            9 * tempData[pos + i] -
            tempData[pos + 4 + i] -
            tempData[pos + width * 4 + i]
          ) * factor + bias;
          
          data[pos + i] = Math.max(0, Math.min(255, val));
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  };
  
  // Apply color enhancement
  const applyColorEnhancement = (ctx: CanvasRenderingContext2D, width: number, height: number, level: number) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const contrast = 1 + (level * 0.1);
    const brightness = level * 3;
    
    for (let i = 0; i < data.length; i += 4) {
      // Apply contrast and brightness
      data[i] = Math.max(0, Math.min(255, (data[i] - 128) * contrast + 128 + brightness));
      data[i+1] = Math.max(0, Math.min(255, (data[i+1] - 128) * contrast + 128 + brightness));
      data[i+2] = Math.max(0, Math.min(255, (data[i+2] - 128) * contrast + 128 + brightness));
    }
    
    ctx.putImageData(imageData, 0, 0);
  };

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
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
  };

  // Select a specific camera by ID
  const selectCamera = (deviceId: string) => {
    setSelectedCameraId(deviceId);
    
    // Reset zoom when switching cameras
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
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
      intervalRef.current = window.setInterval(capture, 750);
    } else {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [isRecording, capture]);

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
  const changeQuality = (newQuality: "standard" | "high" | "ultra") => {
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
        
        {/* Quality indicator */}
        <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm font-medium z-10">
          {quality === "ultra" ? "ULTRA HD" : quality === "high" ? "HD" : "Standard"}
        </div>
        
        {/* Camera indicator */}
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm font-medium z-10">
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
            filter: quality === "ultra" ? "contrast(1.05) brightness(1.05)" : "none" // Subtle enhancement
          }}
        >
          <Webcam
            audio={false}
            height={2160}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            width={3840}
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
      
      {/* Main controls */}
      <div className="flex items-center justify-center space-x-4 flex-wrap">
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
          onClick={handleResetZoom}
          className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
          title="Reset Zoom"
        >
          <Minimize size={24} />
        </button>
        
        <button 
          onClick={handleMaxZoom}
          className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
          title="Maximum Zoom"
        >
          <Maximize size={24} />
        </button>
        
        <button 
          onClick={toggleAutoFocus}
          className={`p-2 rounded-full ${autoFocus ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'} hover:bg-opacity-80`}
          title={autoFocus ? "Auto Focus On" : "Auto Focus Off"}
        >
          <Focus size={24} />
        </button>
        
        <button 
          onClick={toggleCamera}
          className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200"
          title="Switch Camera"
        >
          <RotateCcw size={24} />
        </button>
        
        <button 
          onClick={refreshCameras}
          className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
          title="Refresh Camera List"
        >
          <RefreshCw size={24} />
        </button>
        
        <button 
          onClick={toggleSettings}
          className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
          title="Settings"
        >
          <Settings size={24} />
        </button>
      </div>
      
      {/* Advanced settings panel */}
      {showSettings && (
        <div className="p-4 bg-white rounded-lg shadow-lg border border-gray-200">
          <h3 className="font-medium text-lg mb-3">Advanced Settings</h3>
          
          <div className="space-y-4">
            {/* Camera selection */}
            {availableCameras.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Camera</label>
                <select 
                  value={selectedCameraId}
                  onChange={(e) => selectCamera(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Auto ({facingMode === "environment" ? "Rear" : "Front"})</option>
                  {availableCameras.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label || `Camera ${camera.deviceId.substring(0, 5)}...`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Quality selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quality</label>
              <div className="flex space-x-2">
                <button
                  onClick={() => changeQuality("standard")}
                  className={`px-3 py-1 rounded ${quality === "standard" ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Standard
                </button>
                <button
                  onClick={() => changeQuality("high")}
                  className={`px-3 py-1 rounded ${quality === "high" ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  High
                </button>
                <button
                  onClick={() => changeQuality("ultra")}
                  className={`px-3 py-1 rounded ${quality === "ultra" ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Ultra HD
                </button>
              </div>
            </div>
            
            {/* Enhancement level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enhancement Level: {enhancementLevel}
              </label>
              <input
                type="range"
                min="0"
                max="5"
                value={enhancementLevel}
                onChange={(e) => setEnhancementLevel(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
            
            {/* Sharpness level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sharpness: {sharpness}
              </label>
              <input
                type="range"
                min="0"
                max="4"
                value={sharpness}
                onChange={(e) => setSharpness(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
            
            {/* Camera capabilities info */}
            <div className="text-sm text-gray-600 mt-2 border-t pt-2">
              <div>Optical Zoom: {opticalZoomSupported ? `Supported (up to ${maxOpticalZoom}x)` : "Not supported"}</div>
              <div>Cameras Detected: {availableCameras.length}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebcamCapture;
