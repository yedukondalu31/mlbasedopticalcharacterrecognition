import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, AlertTriangle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center max-w-md space-y-6">
        <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <div className="space-y-2">
          <p className="text-xl font-semibold text-foreground">Page not found</p>
          <p className="text-sm text-muted-foreground">
            The page <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{location.pathname}</code> doesn't exist.
          </p>
        </div>
        <Button onClick={() => navigate("/")} size="lg" className="gap-2">
          <Home className="h-4 w-4" />
          Back to Home
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
