import { ScanSearch, Zap, CheckCircle, TrendingUp } from "lucide-react";

const Hero = () => {
  return (
    <header className="relative overflow-hidden bg-gradient-hero text-primary-foreground">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz48L2c+PC9zdmc+')] opacity-20"></div>
      
      <div className="container relative mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto max-w-4xl text-center space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm">
            <ScanSearch className="h-5 w-5" />
            <span className="text-sm font-medium">AI-Powered OCR Technology</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            Automated Answer Sheet
            <span className="block bg-gradient-to-r from-accent to-white bg-clip-text text-transparent">
              Evaluation System
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-primary-foreground/90 max-w-2xl mx-auto">
            Transform your grading process with advanced image processing and OCR technology. 
            Upload answer sheets, set answer keys, and get instant evaluation results with precision accuracy.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
            <FeatureCard 
              icon={<Zap className="h-6 w-6" />}
              title="Lightning Fast"
              description="Process sheets in seconds"
            />
            <FeatureCard 
              icon={<CheckCircle className="h-6 w-6" />}
              title="Accurate Results"
              description="AI-powered precision"
            />
            <FeatureCard 
              icon={<TrendingUp className="h-6 w-6" />}
              title="Detailed Reports"
              description="Comprehensive analytics"
            />
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent"></div>
    </header>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => {
  return (
    <div className="group rounded-2xl bg-white/5 backdrop-blur-sm p-6 border border-white/10 transition-all hover:bg-white/10 hover:shadow-glow">
      <div className="mb-3 inline-flex items-center justify-center rounded-xl bg-white/10 p-3 transition-transform group-hover:scale-110">
        {icon}
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-primary-foreground/80">{description}</p>
    </div>
  );
};

export default Hero;
