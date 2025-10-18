import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, CheckCircle, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 text-primary mx-auto">
          <Smartphone className="h-10 w-10" />
        </div>

        <div>
          <h1 className="text-3xl font-bold mb-2">Install Grade Ace</h1>
          <p className="text-muted-foreground">
            Install our app for quick access and offline functionality
          </p>
        </div>

        {isInstalled ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-success">
              <CheckCircle className="h-6 w-6" />
              <span className="font-semibold">App Installed!</span>
            </div>
            <Button onClick={() => navigate('/')} size="lg" className="w-full">
              Open App
            </Button>
          </div>
        ) : deferredPrompt ? (
          <div className="space-y-4">
            <Button onClick={handleInstall} size="lg" className="w-full">
              <Download className="mr-2 h-5 w-5" />
              Install App
            </Button>
            <Button onClick={() => navigate('/')} variant="outline" size="lg" className="w-full">
              Continue in Browser
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg text-left space-y-2">
              <p className="text-sm font-semibold">To install on your device:</p>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• iOS: Tap Share → Add to Home Screen</li>
                <li>• Android: Tap Menu → Install App</li>
                <li>• Desktop: Look for install icon in address bar</li>
              </ul>
            </div>
            <Button onClick={() => navigate('/')} variant="outline" size="lg" className="w-full">
              Continue in Browser
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Install;
