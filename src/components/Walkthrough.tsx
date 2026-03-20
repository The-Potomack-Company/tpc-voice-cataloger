import { useState } from 'react';
import { getStepsForRole } from './walkthrough/walkthroughSteps';

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
    <div className="flex flex-col items-center justify-center min-h-full px-8 py-12 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-sm w-full text-center">
        {/* Role section label - only on first role-specific step */}
        {step.roleSection && (
          <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-4">
            {step.roleSection === 'admin' ? 'ADMIN FEATURES' : 'YOUR WORKFLOW'}
          </p>
        )}

        {/* Step icon */}
        {step.icon}

        {/* Step title */}
        <h2 className="text-2xl font-semibold mb-4">{step.title}</h2>

        {/* Step description */}
        <p className="text-gray-600 dark:text-gray-400 mb-10 leading-relaxed">
          {step.description}
        </p>

        {/* Navigation buttons */}
        <div className="flex gap-3 w-full">
          {currentStep > 0 && (
            <button
              onClick={handleBack}
              className="min-h-12 px-4 py-3 text-accent font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 min-h-12 bg-accent hover:bg-accent-hover text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {isLastStep ? 'Start Cataloging' : 'Next'}
          </button>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 mt-8">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {currentStep + 1} / {totalSteps}
        </span>
        <div className="flex gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i <= currentStep
                  ? 'bg-accent'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Skip link - visible from step 1 onward */}
      {currentStep > 0 && (
        <button
          onClick={handleSkip}
          className="mt-4 text-sm text-gray-500 dark:text-gray-400 underline hover:text-gray-700 dark:hover:text-gray-300"
        >
          Skip tutorial
        </button>
      )}
    </div>
  );
}
