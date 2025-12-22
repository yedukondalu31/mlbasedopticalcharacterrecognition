import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  number: number;
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

const StepIndicator = ({ steps, currentStep }: StepIndicatorProps) => {
  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.number;
          const isCurrent = currentStep === step.number;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.number} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold",
                    "transition-all duration-500 ease-out",
                    isCompleted && "bg-primary text-primary-foreground scale-100",
                    isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20 animate-pulse",
                    !isCompleted && !isCurrent && "bg-muted text-muted-foreground scale-95 opacity-60"
                  )}
                  style={{
                    transform: isCurrent ? 'scale(1.1)' : isCompleted ? 'scale(1)' : 'scale(0.95)',
                  }}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5 animate-scale-in" />
                  ) : (
                    <span className={cn(
                      "transition-opacity duration-300",
                      isCurrent && "animate-fade-in"
                    )}>
                      {step.number}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "mt-2 text-xs text-center max-w-[80px] transition-all duration-300",
                    (isCompleted || isCurrent) ? "text-foreground font-medium translate-y-0 opacity-100" : "text-muted-foreground translate-y-1 opacity-60"
                  )}
                >
                  {step.label}
                </span>
              </div>
              
              {!isLast && (
                <div className="flex-1 mx-2 h-1 rounded-full overflow-hidden bg-muted">
                  <div
                    className={cn(
                      "h-full bg-primary rounded-full transition-all duration-700 ease-out"
                    )}
                    style={{
                      width: isCompleted ? '100%' : '0%',
                      transitionDelay: isCompleted ? '150ms' : '0ms',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepIndicator;
