"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, HelpCircle } from "lucide-react";
import { faqData } from "@/data/faq";
import { FAQItem } from "@/components/faq/FAQItem";
import { Button, PageHeader } from "@/components/ui";
import { useSupport } from "@/components/support/support-context";
import { cn } from "@/lib/utils";

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(faqData[0].id);
  const { openSupport } = useSupport();

  // Search logic
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return faqData;

    const query = searchQuery.toLowerCase().trim();
    
    return faqData.map(category => {
      const matchingItems = category.items.filter(item => {
        return (
          item.question.toLowerCase().includes(query) ||
          (typeof item.answer === 'string' && item.answer.toLowerCase().includes(query)) ||
          category.label.toLowerCase().includes(query)
        );
      });
      return { ...category, items: matchingItems };
    }).filter(category => category.items.length > 0);
  }, [searchQuery]);

  const hasResults = filteredData.length > 0;

  // Intersection observer for sticky nav (desktop)
  useEffect(() => {
    if (searchQuery) return; // Disable sticky scroll tracking when searching

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveCategory(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -80% 0px" } // trigger when near top of viewport
    );

    faqData.forEach((category) => {
      const element = document.getElementById(category.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [searchQuery]);

  const scrollToCategory = (id: string) => {
    setActiveCategory(id);
    const element = document.getElementById(id);
    if (element) {
      const y = element.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <PageHeader 
          title="Help Center" 
          description="Straight answers to help you get more from AdsHunting."
        />
        
        <div className="mt-8 relative max-w-xl">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search size={18} className="text-muted" />
          </div>
          <input
            type="text"
            className="h-12 w-full rounded-xl border border-line bg-white pl-10 pr-4 text-[15px] outline-none transition-shadow focus:border-brand focus:ring-1 focus:ring-brand shadow-sm"
            placeholder="Search help articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 items-start">
        
        {/* Mobile Category Selector */}
        {!searchQuery && (
          <div className="w-full overflow-x-auto pb-2 lg:hidden scrollbar-hide flex gap-2">
            {faqData.map((category) => (
              <button
                key={category.id}
                onClick={() => scrollToCategory(category.id)}
                className={cn(
                  "whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors border",
                  activeCategory === category.id 
                    ? "bg-brand/10 text-brand border-brand/20" 
                    : "bg-white text-muted border-line hover:text-ink hover:bg-surface"
                )}
              >
                {category.label}
              </button>
            ))}
          </div>
        )}

        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-56 shrink-0 sticky top-[100px]">
          <nav className="flex flex-col gap-1 border-l border-line/60">
            {faqData.map((category) => (
              <button
                key={category.id}
                onClick={() => scrollToCategory(category.id)}
                className={cn(
                  "text-left px-4 py-2 text-sm font-medium transition-all relative border-l-2 -ml-[1px]",
                  activeCategory === category.id
                    ? "text-brand border-brand bg-brand/5"
                    : "text-muted border-transparent hover:text-ink hover:bg-surface"
                )}
              >
                {category.label}
              </button>
            ))}
          </nav>

          <div className="mt-10 rounded-xl bg-surface/50 border border-line p-5">
            <div className="flex size-10 items-center justify-center rounded-full bg-brand/10 text-brand mb-4">
              <HelpCircle size={20} />
            </div>
            <h3 className="font-semibold text-ink text-sm">Still need help?</h3>
            <p className="text-xs text-muted mt-1.5 mb-4">
              Can&apos;t find what you&apos;re looking for? Reach out to our team.
            </p>
            <Button
              variant="secondary"
              className="w-full text-xs h-9 bg-white"
              onClick={() => openSupport()}
            >
              Contact support
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 w-full min-w-0">
          {!hasResults ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-line rounded-2xl bg-surface/30">
              <div className="flex size-12 items-center justify-center rounded-full bg-white shadow-sm border border-line text-muted mb-4">
                <Search size={20} />
              </div>
              <h3 className="text-lg font-semibold text-ink">No matching help articles found</h3>
              <p className="mt-2 text-sm text-muted max-w-sm mx-auto">
                We couldn&apos;t find any articles matching &quot;{searchQuery}&quot;. Try a different search term or contact our support team.
              </p>
              <Button
                variant="primary"
                className="mt-6"
                onClick={() => openSupport()}
              >
                Contact support
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-10">
              {filteredData.map((category) => (
                <div key={category.id} id={category.id} className="scroll-mt-[100px]">
                  <h2 className="text-xl font-semibold tracking-tight text-ink mb-4">{category.label}</h2>
                  <div className="rounded-xl border border-line bg-white px-5 sm:px-6">
                    {category.items.map((item) => (
                      <FAQItem
                        key={item.id}
                        id={item.id}
                        question={item.question}
                        answer={item.answer}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
