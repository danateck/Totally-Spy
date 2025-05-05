import React from "react";
import Webcam from "react-webcam";

const videoConstraints = {
  width: 1280,
  height: 720,
  facingMode: "user"
};

interface WebcamCaptureProps {
  onCapture?: (imageSrc: string) => void;
  isRecording: boolean;
}

const WebcamCapture: React.FC<WebcamCaptureProps> = ({ onCapture, isRecording }) => {
  const webcamRef = React.useRef<Webcam>(null);
  const intervalRef = React.useRef<number | undefined>(undefined);
  
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
    <div className="space-y-4">
      <Webcam
        audio={false}
        height={720}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        width={1280}
        videoConstraints={videoConstraints}
        className="rounded-lg shadow-lg"
      />
    </div>
  );
};

export default WebcamCapture;