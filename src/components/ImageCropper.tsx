import { useState, useRef, useCallback } from "react";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import { Crop as CropIcon, Check, RotateCcw, X } from "lucide-react";

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedImageUrl: string) => void;
  onCancel: () => void;
}

const ImageCropper = ({ imageSrc, onCropComplete, onCancel }: ImageCropperProps) => {
  const [crop, setCrop] = useState<Crop>({
    unit: "%",
    x: 10,
    y: 10,
    width: 80,
    height: 80,
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const resetCrop = () => {
    setCrop({ unit: "%", x: 10, y: 10, width: 80, height: 80 });
  };

  const getCroppedImage = useCallback(() => {
    if (!imgRef.current || !completedCrop) return;

    const image = imgRef.current;
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    onCropComplete(croppedDataUrl);
  }, [completedCrop, onCropComplete]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-6 pt-2">
        <CropIcon className="h-5 w-5 text-primary" />
        <p className="text-sm font-medium text-foreground">
          Drag to select the answer sheet area, then confirm
        </p>
      </div>

      <div className="flex justify-center bg-muted/30 p-2 max-h-[500px] overflow-auto">
        <ReactCrop
          crop={crop}
          onChange={(c) => setCrop(c)}
          onComplete={(c) => setCompletedCrop(c)}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop answer sheet"
            className="max-h-[460px] w-auto"
          />
        </ReactCrop>
      </div>

      <div className="flex justify-center gap-3 px-6 pb-4">
        <Button variant="outline" size="sm" onClick={resetCrop}>
          <RotateCcw className="mr-1 h-4 w-4" />
          Reset
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          <X className="mr-1 h-4 w-4" />
          Skip Crop
        </Button>
        <Button size="sm" onClick={getCroppedImage} disabled={!completedCrop}>
          <Check className="mr-1 h-4 w-4" />
          Apply Crop
        </Button>
      </div>
    </div>
  );
};

export default ImageCropper;
