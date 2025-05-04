import React, { useState, useEffect, useCallback, useRef } from "react";
import Webcam from "react-webcam";
import { ZoomIn, ZoomOut, Maximize, Minimize } from "lucide-react";

const videoConstraints = {
  width: 1920, // Increased resolution for better zoom quality
  height: 1080,
  facingMode: "user"
};

interface WebcamCaptureProps {
  onCapture?: (imageSrc: string) => void;
  isRecording: boolean;
}

const WebcamCapture: React.FC<WebcamCaptureProps> = ({ onCapture, isRecording }) => {
  const webcamRef = useRef<Webcam>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<number | undefined>(undefined);
  
  // Zoom state
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc && onCapture) {
      onCapture(imageSrc);
    }
  }, [webcamRef, onCapture]);

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

  return (
    <div className="space-y-4">
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
        <div
          style={{
            transform: `scale(${zoomLevel}) translate(${position.x / zoomLevel}px, ${position.y / zoomLevel}px)`,
            transformOrigin: 'center',
            transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            width: '100%',
            height: '100%'
          }}
        >
          <Webcam
            audio={false}
            height={1080}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            width={1920}
            videoConstraints={videoConstraints}
            className="w-full h-full object-cover"
          />
        </div>
      </div>
      
      {/* Zoom controls */}
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
      </div>
    </div>
  );
};

export default WebcamCapture;