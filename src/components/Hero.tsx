import { ScanSearch, Zap, CheckCircle, TrendingUp } from "lucide-react";

const Hero = () => {
  return (
    <header className="relative overflow-hidden bg-gradient-hero text-primary-foreground">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz48L2c+PC9zdmc+')] opacity-20"></div>
      
      <div className="container relative mx-auto px-4 py-8 md:py-16">
        <div className="mx-auto max-w-4xl text-center space-y-4 md:space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 md:px-4 md:py-2 backdrop-blur-sm">
            <ScanSearch className="h-4 w-4 md:h-5 md:w-5" />
            <span className="text-xs md:text-sm font-medium">AI-Powered OCR</span>
          </div>
          
          <h1 className="text-2xl md:text-4xl lg:text-6xl font-bold leading-tight px-2">
            Answer Sheet
            <span className="block bg-gradient-to-r from-accent to-white bg-clip-text text-transparent">
              Grading App
            </span>
          </h1>
          
          <p className="text-sm md:text-lg lg:text-xl text-primary-foreground/90 max-w-2xl mx-auto px-4">
            Snap, grade, done. AI-powered answer sheet evaluation in seconds.
          </p>

          <div className="grid grid-cols-3 md:grid-cols-3 gap-3 md:gap-6 pt-4 md:pt-8 px-2">
            <FeatureCard 
              icon={<Zap className="h-4 w-4 md:h-6 md:w-6" />}
              title="Fast"
              description="Instant results"
            />
            <FeatureCard 
              icon={<CheckCircle className="h-4 w-4 md:h-6 md:w-6" />}
              title="Accurate"
              description="AI precision"
            />
            <FeatureCard 
              icon={<TrendingUp className="h-4 w-4 md:h-6 md:w-6" />}
              title="Reports"
              description="Full analytics"
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
    <div className="group rounded-xl md:rounded-2xl bg-white/5 backdrop-blur-sm p-3 md:p-6 border border-white/10 transition-all hover:bg-white/10 hover:shadow-glow">
      <div className="mb-2 md:mb-3 inline-flex items-center justify-center rounded-lg md:rounded-xl bg-white/10 p-2 md:p-3 transition-transform group-hover:scale-110">
        {icon}
      </div>
      <h3 className="font-semibold text-xs md:text-base mb-0.5 md:mb-1">{title}</h3>
      <p className="text-[10px] md:text-sm text-primary-foreground/80">{description}</p>
    </div>
  );
};

export default Hero;
