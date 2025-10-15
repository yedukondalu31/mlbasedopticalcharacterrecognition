import { useCallback, useState } from "react";
import { Upload, Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ImageUploadProps {
  onImageUpload: (imageUrl: string) => void;
  currentImage: string | null;
}

const ImageUpload = ({ onImageUpload, currentImage }: ImageUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);

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

  return (
    <section className="w-full">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-foreground mb-2">Upload Answer Sheet</h2>
        <p className="text-muted-foreground">
          Drag and drop your answer sheet image or click to browse
        </p>
      </div>

      <Card className="overflow-hidden bg-gradient-card border-2 transition-all hover:shadow-lg">
        {!currentImage ? (
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

              <Button variant="outline" className="mt-4" asChild>
                <label htmlFor="file-upload" className="cursor-pointer">
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Choose Image
                </label>
              </Button>

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
