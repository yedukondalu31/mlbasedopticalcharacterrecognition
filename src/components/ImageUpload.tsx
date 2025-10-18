import { useCallback, useState, useRef } from "react";
import { Upload, Image as ImageIcon, X, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadProps {
  onImageUpload: (imageUrl: string) => void;
  currentImage: string | null;
}

const ImageUpload = ({ onImageUpload, currentImage }: ImageUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  const handleFile = useCallback((file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        onImageUpload(result);
      };
      reader.readAsDataURL(file);
    }
  }, [onImageUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleRemove = () => {
    onImageUpload("");
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setShowCamera(true);
      }
    } catch (error) {
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera access to take photos.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const imageUrl = canvas.toDataURL('image/jpeg');
        onImageUpload(imageUrl);
        stopCamera();
      }
    }
  };

  return (
    <section className="w-full">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-foreground mb-2">Upload Answer Sheet</h2>
        <p className="text-muted-foreground">
          Drag and drop your answer sheet image or click to browse
        </p>
      </div>

      <Card className="overflow-hidden bg-gradient-card border-2 transition-all hover:shadow-lg">
        {showCamera ? (
          <div className="relative">
            <video 
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-auto max-h-[500px]"
            />
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
            className={`relative p-12 text-center transition-all ${
              isDragging 
                ? 'border-primary bg-primary/5 scale-[1.02]' 
                : 'border-border hover:border-primary/50'
            }`}
          >
            <input
              type="file"
              accept="image/*"
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
                  Drop your answer sheet here
                </p>
                <p className="text-sm text-muted-foreground">
                  or click to browse from your device
                </p>
              </div>

              <div className="flex gap-3 justify-center">
                <Button variant="outline" className="mt-4" asChild>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Choose Image
                  </label>
                </Button>
                
                <Button variant="outline" className="mt-4" onClick={startCamera}>
                  <Camera className="mr-2 h-4 w-4" />
                  Take Photo
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mt-4">
                Supports: JPG, PNG, JPEG (Max 10MB)
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
