import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";

const PrivacyNotice = () => {
  return (
    <Alert className="mb-6">
      <InfoIcon className="h-4 w-4" />
      <AlertTitle>Privacy & Data Protection</AlertTitle>
      <AlertDescription className="text-sm space-y-2">
        <p>
          <strong>Your privacy matters:</strong> All uploaded images are processed securely and temporarily.
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Images are validated and enhanced automatically for best results</li>
          <li>Processing happens on secure servers with encrypted connections</li>
          <li>No images are stored permanently on our servers</li>
          <li>All data is processed in compliance with data protection standards</li>
          <li>Do not upload sensitive personal information unless necessary</li>
        </ul>
        <p className="text-xs text-muted-foreground mt-2">
          By uploading images, you consent to temporary processing for answer sheet analysis only.
        </p>
      </AlertDescription>
    </Alert>
  );
};

export default PrivacyNotice;
