import React from 'react';

interface AdSlotProps {
  slotId?: string;
  format?: 'horizontal' | 'rectangle' | 'responsive';
  className?: string;
}

/**
 * AdSlot placeholder component.
 * Reserves exact layout space to prevent Cumulative Layout Shift (CLS).
 * Ready for future ad network integration without structural alterations.
 */
export function AdSlot({ slotId = 'banner-top', format = 'horizontal', className = '' }: AdSlotProps) {
  const formatClasses = {
    horizontal: 'h-[90px] md:h-[100px] w-full max-w-[970px]',
    rectangle: 'h-[250px] w-full max-w-[300px]',
    responsive: 'min-h-[90px] md:min-h-[120px] w-full',
  }[format];

  return (
    <div
      id={`ad-container-${slotId}`}
      className={`my-6 flex flex-col items-center justify-center mx-auto ${className}`}
      aria-label="Advertisement space"
    >
      <div
        className={`${formatClasses} bg-[#F8FAFC] border border-dashed border-[#E5E7EB] rounded-lg flex flex-col items-center justify-center text-center p-4 select-none`}
      >
        <span className="text-[11px] font-medium uppercase tracking-widest text-[#667085]/70">
          Advertisement
        </span>
        <span className="text-xs text-[#667085]/50 mt-1">
          Space reserved to eliminate layout shift
        </span>
      </div>
    </div>
  );
}

export default AdSlot;
