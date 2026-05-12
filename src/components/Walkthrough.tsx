import { useState } from 'react';
import { getStepsForRole } from './walkthrough/walkthroughSteps';
import { Button } from '../ui/Button';
import { Eyebrow } from '../ui/Eyebrow';

interface WalkthroughProps {
  role: string | null;
  onComplete: () => void;
}

export function Walkthrough({ role, onComplete }: WalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const steps = getStepsForRole(role);
  const totalSteps = steps.length;
  const isLastStep = currentStep === totalSteps - 1;
  const step = steps[currentStep];

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-8 py-12">
      <div className="max-w-sm w-full text-center">
        {/* Role section label - only on first role-specific step */}
        {step.roleSection && (
          <Eyebrow className="mb-4">
            {step.roleSection === 'admin' ? 'Admin features' : 'Your workflow'}
          </Eyebrow>
        )}

        {/* Step icon */}
        {step.icon}

        {/* Step title — italic display per unified design language */}
        <h2 className="tpc-display tpc-display-3 mb-4 text-ink">{step.title}</h2>

        {/* Step description */}
        <p className="text-ink-2 mb-10 leading-relaxed">
          {step.description}
        </p>

        {/* Navigation buttons */}
        <div className="flex gap-3 w-full">
          {currentStep > 0 && (
            <Button variant="ghost" onClick={handleBack}>
              Back
            </Button>
          )}
          <Button onClick={handleNext} fullWidth>
            {isLastStep ? 'Start Cataloging' : 'Next'}
          </Button>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 mt-8">
        <span className="text-sm text-ink-3 tnum">
          {currentStep + 1} / {totalSteps}
        </span>
        <div className="flex gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i <= currentStep ? 'bg-accent' : 'bg-rule'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Skip link - visible from step 1 onward */}
      {currentStep > 0 && (
        <Button variant="ghost" size="sm" onClick={handleSkip} className="mt-4">
          Skip tutorial
        </Button>
      )}
    </div>
  );
}
