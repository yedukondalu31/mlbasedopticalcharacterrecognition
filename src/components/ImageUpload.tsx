import { useState, useRef } from "react";
import * as React from "react";
import { Upload, Image as ImageIcon, X, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadProps {
  onImageUpload: (imageUrl: string) => void;
  currentImage: string | null;
}

const ImageUpload = ({ onImageUpload, currentImage }: ImageUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  // File validation constants
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
  const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const MIN_FILE_SIZE = 1024; // 1KB minimum to avoid corrupted files

  const verifyFileSignature = async (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = (e) => {
        if (!e.target?.result) {
          resolve(false);
          return;
        }
        
        const arr = new Uint8Array(e.target.result as ArrayBuffer).subarray(0, 4);
        
        // Check PNG signature
        if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47) {
          resolve(true);
          return;
        }
        
        // Check JPEG signature
        if (arr[0] === 0xFF && arr[1] === 0xD8 && arr[2] === 0xFF) {
          resolve(true);
          return;
        }
        
        resolve(false);
      };
      reader.onerror = () => resolve(false);
      reader.readAsArrayBuffer(file.slice(0, 4));
    });
  };

  const compressImage = async (dataUrl: string, maxWidth: number = 1920, maxHeight: number = 1920): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Apply image preprocessing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw and enhance image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Auto-adjust contrast and brightness
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // Simple contrast enhancement
        const factor = 1.2;
        const intercept = 128 * (1 - factor);
        
        for (let i = 0; i < data.length; i += 4) {
          data[i] = data[i] * factor + intercept;     // Red
          data[i + 1] = data[i + 1] * factor + intercept; // Green
          data[i + 2] = data[i + 2] * factor + intercept; // Blue
        }
        
        ctx.putImageData(imageData, 0, 0);

        // Compress to JPEG with quality 0.85
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(compressedDataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  };

  const handleFile = async (file: File) => {
    try {
      // 1. File type validation (extension)
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
        toast({
          title: "Invalid file type",
          description: "Please upload only JPG, JPEG, or PNG images.",
          variant: "destructive",
        });
        return;
      }

      // 2. MIME type validation
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast({
          title: "Invalid file format",
          description: "File type not supported. Use JPG, JPEG, or PNG only.",
          variant: "destructive",
        });
        return;
      }

      // 3. File size validation
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: `Maximum file size is 10MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`,
          variant: "destructive",
        });
        return;
      }

      if (file.size < MIN_FILE_SIZE) {
        toast({
          title: "File too small",
          description: "The file appears to be corrupted or empty.",
          variant: "destructive",
        });
        return;
      }

      // 4. Verify file signature (magic bytes)
      const isValidSignature = await verifyFileSignature(file);
      if (!isValidSignature) {
        toast({
          title: "Security check failed",
          description: "File signature verification failed. The file may be corrupted or spoofed.",
          variant: "destructive",
        });
        return;
      }

      // 5. Read and process the file
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const originalDataUrl = reader.result as string;
          
          // 6. Compress and preprocess the image
          toast({
            title: "Processing image...",
            description: "Optimizing and enhancing image quality",
          });
          
          const processedDataUrl = await compressImage(originalDataUrl);
          
          // 7. Pass to parent component
          onImageUpload(processedDataUrl);
        } catch (error) {
          console.error("Error processing image:", error);
          toast({
            title: "Processing failed",
            description: "Failed to process the image. Please try another image.",
            variant: "destructive",
          });
        }
      };
      
      reader.onerror = () => {
        toast({
          title: "Upload failed",
          description: "Failed to read the file. Please try again.",
          variant: "destructive",
        });
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error handling file:", error);
      toast({
        title: "Upload error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleRemove = () => {
    onImageUpload("");
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setShowCamera(true);
        
        toast({
          title: "Camera ready",
          description: "Position the answer sheet flat and well-lit for best results.",
        });
      }
    } catch (error) {
      console.error("Camera error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      toast({
        title: "Camera Access Denied",
        description: `Please allow camera access in your browser settings. Error: ${errorMessage}`,
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log("Camera track stopped:", track.label);
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };
  
  // Cleanup camera on unmount
  React.useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        
        try {
          // Process the captured photo
          toast({
            title: "Processing photo...",
            description: "Enhancing image quality",
          });
          
          const processedDataUrl = await compressImage(imageDataUrl);
          onImageUpload(processedDataUrl);
          stopCamera();
        } catch (error) {
          console.error("Error processing captured photo:", error);
          toast({
            title: "Processing failed",
            description: "Failed to process the captured photo. Please try again.",
            variant: "destructive",
          });
        }
      }
    }
  };

  return (
    <section className="w-full">
      <Card className="overflow-hidden bg-gradient-card border-2 transition-all hover:shadow-lg">
        <div className="p-6">
          <CardTitle className="text-2xl font-bold">Upload Answer Sheet</CardTitle>
          <CardDescription>
            Take a photo or upload an image of the completed answer sheet
            <div className="mt-2 text-xs text-muted-foreground space-y-1">
              <p>✓ Accepted formats: JPG, JPEG, PNG (Max 10MB)</p>
              <p>✓ Images are validated, compressed, and enhanced automatically</p>
              <p>✓ Your images are processed securely and not stored permanently</p>
              <p className="text-amber-600 dark:text-amber-400">⚠️ Do not upload sensitive personal documents unless necessary</p>
            </div>
          </CardDescription>
        </div>

        {showCamera ? (
          <div className="relative">
            <video 
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-auto max-h-[500px]"
            />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
              <Button onClick={capturePhoto} size="lg" className="shadow-lg">
                <Camera className="mr-2 h-5 w-5" />
                Capture Photo
              </Button>
              <Button onClick={stopCamera} variant="outline" size="lg" className="shadow-lg">
                Cancel
              </Button>
            </div>
          </div>
        ) : !currentImage ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative p-12 text-center transition-all border-2 border-dashed ${
              isDragging 
                ? 'border-primary bg-primary/5 scale-[1.02]' 
                : 'border-border hover:border-primary/50'
            }`}
          >
            <input
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/jpg,image/png"
              capture="environment"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              id="file-upload"
            />
            
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 text-primary transition-transform hover:scale-110">
                <Upload className="h-10 w-10" />
              </div>
              
              <div>
                <p className="text-lg font-semibold text-foreground mb-1">
                  Drop your answer sheet here or
                </p>
                <p className="text-sm text-muted-foreground">
                  JPG, JPEG, PNG only (Max 10MB)
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Files are automatically validated and optimized
                </p>
              </div>

              <div className="flex gap-3 justify-center mt-6">
                <Button variant="default" size="lg" onClick={startCamera}>
                  <Camera className="mr-2 h-5 w-5" />
                  Take Photo
                </Button>
                
                <Button variant="outline" size="lg" asChild>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <ImageIcon className="mr-2 h-5 w-5" />
                    Upload/Camera
                  </label>
                </Button>
              </div>
              
              <p className="text-xs text-center text-muted-foreground mt-3">
                "Upload/Camera" button opens your device camera or gallery
              </p>
            </div>
          </div>
        ) : (
          <div className="relative group">
            <img 
              src={currentImage} 
              alt="Uploaded answer sheet" 
              className="w-full h-auto max-h-[500px] object-contain"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button 
                onClick={handleRemove}
                variant="destructive"
                size="lg"
                className="shadow-lg"
              >
                <X className="mr-2 h-4 w-4" />
                Remove Image
              </Button>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
};

export default ImageUpload;
