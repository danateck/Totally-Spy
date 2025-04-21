import React from "react";
import Webcam from "react-webcam";

interface WebcamCaptureProps {
  onCapture?: (imageSrc: string) => void;
  isRecording: boolean;
}

const WebcamCapture: React.FC<WebcamCaptureProps> = ({ onCapture, isRecording }) => {
  const webcamRef = React.useRef<Webcam>(null);
  const intervalRef = React.useRef<number | undefined>(undefined);
  const [facingMode, setFacingMode] = React.useState<"user" | "environment">("environment");
  
  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: facingMode
  };

  const handleCameraSwitch = () => {
    setFacingMode(prevMode => prevMode === "user" ? "environment" : "user");
  };
  
  const capture = React.useCallback(
    async () => {
      const imageSrc = webcamRef.current?.getScreenshot();
      if (imageSrc && onCapture) {
        onCapture(imageSrc);
      }
    },
    [webcamRef, onCapture]
  );

  React.useEffect(() => {
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

  return (
    <div className="relative">
      <Webcam
        audio={false}
        height={720}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        width={1280}
        videoConstraints={videoConstraints}
        className="rounded-lg shadow-lg"
      />
      <button
        onClick={handleCameraSwitch}
        className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
        title={facingMode === "user" ? "Switch to back camera" : "Switch to front camera"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
          />
        </svg>
      </button>
    </div>
  );
};

export default WebcamCapture;