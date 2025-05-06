import React, { useState, useEffect, useCallback, useRef } from "react";
import Webcam from "react-webcam";
import { ZoomIn, ZoomOut, Maximize, Minimize, Focus, Settings } from "lucide-react";

const videoConstraints = {
  width: 3840, // 4K resolution for maximum quality when zooming
  height: 2160,
  facingMode: "user",
  aspectRatio: 16/9,
  frameRate: { ideal: 30, max: 60 },
  // Set to true to prefer highest resolution available
  advanced: [{ zoom: 1 }] as any
};

interface WebcamCaptureProps {
  onCapture?: (imageSrc: string) => void;
  isRecording: boolean;
  initialQuality?: "standard" | "high" | "ultra"; // Quality presets
}

const WebcamCapture: React.FC<WebcamCaptureProps> = ({ onCapture, isRecording, initialQuality = "high" }) => {
  const webcamRef = useRef<Webcam>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<number | undefined>(undefined);
  
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
  
  // Zoom state
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [autoFocus, setAutoFocus] = useState(true);
  
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
    
    // Draw the current frame from video to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
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
  }, [webcamRef, canvasRef, videoRef, onCapture, quality, enhancementLevel, sharpness]);
  
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
    setZoomLevel(prev => Math.min(prev + 0.25, 4));
  };

  // Handle zooming out with limits
  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const newZoom = Math.max(prev - 0.25, 1);
      
      // Reset position if zooming back to 1
      if (newZoom === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
  };

  // Reset zoom to default
  const handleResetZoom = () => {
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
  };

  // Maximize zoom
  const handleMaxZoom = () => {
    setZoomLevel(4);
  };

  // Start dragging to pan the zoomed view
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  // Update position while dragging
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
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
    setAutoFocus(!autoFocus);
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
          cursor: zoomLevel > 1 ? 'move' : 'default'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Zoom indicator */}
        <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm font-medium z-10">
          {Math.round(zoomLevel * 100)}%
        </div>
        
        {/* Quality indicator */}
        <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm font-medium z-10">
          {quality === "ultra" ? "ULTRA HD" : quality === "high" ? "HD" : "Standard"}
        </div>
        
        <div
          style={{
            transform: `scale(${zoomLevel}) translate(${position.x / zoomLevel}px, ${position.y / zoomLevel}px)`,
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
            videoConstraints={{
              ...videoConstraints
            }}
            imageSmoothing={true}
            className="w-full h-full object-cover"
            forceScreenshotSourceSize
          />
        </div>
        
        {/* Zoom focus indicator */}
        {zoomLevel > 1 && (
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
      <div className="flex items-center justify-center space-x-4">
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
          disabled={zoomLevel >= 4}
          className={`p-2 rounded-full ${zoomLevel >= 4 ? 'bg-gray-200 text-gray-400' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
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
          </div>
        </div>
      )}
    </div>
  );
};

export default WebcamCapture;
