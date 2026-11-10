'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface FAQItem {
  question: string;
  answer: string;
}

interface FAQProps {
  items: FAQItem[];
  title?: string;
  className?: string;
}

export function FAQ({ items, title = 'Frequently Asked Questions', className = '' }: FAQProps) {
  const [openIndices, setOpenIndices] = useState<number[]>([0]);

  const toggleIndex = (index: number) => {
    setOpenIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  if (!items || items.length === 0) return null;

  return (
    <section className={`w-full py-8 ${className}`} aria-labelledby="faq-heading">
      <div className="mb-6">
        <h2 id="faq-heading" className="text-2xl md:text-3xl font-bold text-[#17202A] tracking-tight">
          {title}
        </h2>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => {
          const isOpen = openIndices.includes(index);
          const buttonId = `faq-btn-${index}`;
          const contentId = `faq-content-${index}`;

          return (
            <div
              key={index}
              className="border border-[#E5E7EB] rounded-card bg-[#FFFFFF] overflow-hidden transition-colors"
            >
              <h3>
                <button
                  id={buttonId}
                  type="button"
                  onClick={() => toggleIndex(index)}
                  aria-expanded={isOpen}
                  aria-controls={contentId}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left font-semibold text-base md:text-lg text-[#17202A] hover:text-[#124A57] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#124A57]"
                >
                  <span>{item.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-[#667085] transition-transform duration-200 flex-shrink-0 ${
                      isOpen ? 'rotate-180 text-[#124A57]' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </h3>
              {isOpen && (
                <div
                  id={contentId}
                  role="region"
                  aria-labelledby={buttonId}
                  className="px-5 pb-5 text-sm md:text-base text-[#667085] leading-relaxed border-t border-[#E5E7EB]/60 pt-3"
                >
                  <p>{item.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default FAQ;
