import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { AppStatus, CameraFeedHandles } from '../types';

interface CameraFeedProps {
  onToggleAutoScan: () => void;
  status: AppStatus;
  isAutoScanning: boolean;
  isCalibrationMode: boolean;
  calibrationItemId: string | null;
  calibrationItemName: string;
  onCaptureReference: (itemId: string, imageData: string) => void;
  onCancelCalibration: () => void;
}

export const CameraFeed = forwardRef<CameraFeedHandles, CameraFeedProps>(({
  onToggleAutoScan,
  status,
  isAutoScanning,
  isCalibrationMode,
  calibrationItemId,
  calibrationItemName,
  onCaptureReference,
  onCancelCalibration
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    if (!context) return null;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    return canvas.toDataURL('image/jpeg').split(',')[1] || null;
  };

  useImperativeHandle(ref, () => ({
    captureFrame
  }));

  useEffect(() => {
    const enableVideoStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera: ", err);
      }
    };

    enableVideoStream();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCaptureReferenceClick = () => {
    if (!calibrationItemId) return;
    const imageData = captureFrame();
    if (imageData) {
      onCaptureReference(calibrationItemId, imageData);
    } else {
      console.error("Could not capture reference image.");
    }
  };
  
  const handleToggleClick = () => {
    onToggleAutoScan();
  };

  const isButtonDisabled = status === 'loading' || isCalibrationMode;
  const buttonClasses = isAutoScanning 
    ? "bg-red-600 hover:bg-red-700" 
    : "bg-cyan-500 hover:bg-cyan-600";

  return (
    <div className="bg-gray-800/50 rounded-xl p-6 shadow-lg border border-gray-700">
      <h3 className="text-xl font-bold text-white mb-4">
        {isCalibrationMode ? "Live Camera: Calibration" : "Live Inventory Camera"}
      </h3>
      <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden border-2 border-gray-700">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden="true"></canvas>

      {isCalibrationMode && calibrationItemId ? (
        <div className="mt-6 text-center">
            <p className="text-cyan-300 font-semibold mb-3">Capturing '{calibrationItemName}'</p>
            <p className="text-gray-400 text-sm mb-4">Position a single, clear example of the item in front of the camera.</p>
            <div className="flex justify-center gap-4">
                 <button onClick={onCancelCalibration} className="bg-gray-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-500 transition-colors">
                    Cancel
                 </button>
                 <button onClick={handleCaptureReferenceClick} className="bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-500 transition-colors flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Capture New Reference
                 </button>
            </div>
        </div>
      ) : !isCalibrationMode ? (
        <div className="mt-6 flex flex-col items-center">
            <button
                onClick={handleToggleClick}
                disabled={isButtonDisabled}
                className={`${buttonClasses} text-white font-bold py-3 px-6 rounded-lg shadow-md transition-all duration-300 ease-in-out disabled:bg-gray-600 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2`}
                aria-label={isAutoScanning ? "Stop automatic monitoring" : "Start automatic monitoring"}
            >
            {status === 'loading' ? (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isAutoScanning ? 
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> :
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  }
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isAutoScanning ? "M15 12H9" : "M21 12a9 9 0 11-18 0 9 9 0 0118 0z"}/>
                </svg>
            )}
            {isAutoScanning ? 'Stop Monitoring' : 'Start Automatic Monitoring'}
            </button>
             <p className="text-center text-gray-400 text-sm mt-4">
                {isAutoScanning 
                    ? "The AI agent is now active."
                    : "Click to begin continuous inventory monitoring."
                }
            </p>
        </div>
      ) : null}
    </div>
  );
});