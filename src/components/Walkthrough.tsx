import { useState } from "react";
import { useUIStore } from "../stores/uiStore";

const steps = [
  {
    title: "Welcome to TPC Catalog",
    description:
      "Your voice-powered cataloging assistant. Dictate auction catalog entries by voice and get structured, accurate data faster than typing.",
    icon: (
      <svg
        className="w-16 h-16 text-accent mx-auto mb-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
        />
      </svg>
    ),
  },
  {
    title: "Two Modes",
    description:
      "House Visit mode lets you capture photos and dictate descriptions during on-site visits. Sale Cataloging mode is for entering receipt numbers and dictating item details for a sale.",
    icon: (
      <svg
        className="w-16 h-16 text-accent mx-auto mb-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
        />
      </svg>
    ),
  },
  {
    title: "Get Started",
    description:
      "Create your first session and start cataloging. Your data stays on your device until you're ready to export.",
    icon: (
      <svg
        className="w-16 h-16 text-accent mx-auto mb-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
        />
      </svg>
    ),
  },
];

export function Walkthrough() {
  const [currentStep, setCurrentStep] = useState(0);
  const completeWalkthrough = useUIStore((s) => s.completeWalkthrough);

  const isLastStep = currentStep === steps.length - 1;
  const step = steps[currentStep];

  const handleNext = () => {
    if (isLastStep) {
      completeWalkthrough();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-8 py-12 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-sm w-full text-center">
        {step.icon}
        <h2 className="text-2xl font-bold mb-4">{step.title}</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-10 leading-relaxed">
          {step.description}
        </p>
        <button
          onClick={handleNext}
          className="w-full bg-accent hover:bg-accent-hover text-white font-medium py-3 px-6 rounded-lg min-h-12 transition-colors"
        >
          {isLastStep ? "Get Started" : "Next"}
        </button>
      </div>
      {/* Progress dots */}
      <div className="flex gap-2 mt-8">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i === currentStep
                ? "bg-accent"
                : "bg-gray-300 dark:bg-gray-600"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
