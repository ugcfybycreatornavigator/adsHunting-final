"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FAQItemProps {
  question: string;
  answer: React.ReactNode;
  id: string;
}

export function FAQItem({ question, answer, id }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-line last:border-0" id={id}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${id}`}
        className="flex w-full items-center justify-between py-4 sm:py-5 text-left text-ink transition hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-md px-2 -mx-2"
      >
        <span className="font-semibold text-[15px] pr-8">{question}</span>
        <ChevronDown
          size={18}
          className={cn(
            "shrink-0 text-muted transition-transform duration-200",
            isOpen && "rotate-180 text-brand"
          )}
        />
      </button>
      <div
        id={`faq-answer-${id}`}
        role="region"
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="pb-5 px-2 -mx-2 text-sm leading-relaxed text-muted">
            {answer}
          </div>
        </div>
      </div>
    </div>
  );
}
