import React from 'react';

interface ProgressBarProps {
  progress: number; // 0 to 100
  label?: string;
  className?: string;
}

export function ProgressBar({ progress, label, className = '' }: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      {label && (
        <div className="flex justify-between items-center text-xs font-semibold text-[#0F112E]">
          <span>{label}</span>
          <span className="text-[#5E6488]">{clampedProgress}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        className="w-full h-2 bg-[#F4F3FA] border border-[#E4E2F0] rounded-full overflow-hidden"
      >
        <div
          className="h-full bg-gradient-to-r from-[#7C3AED] to-[#6366F1] transition-all duration-300 ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
