'use client';

import React, { useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pricingPlans } from '@/data/landing/config';

type FAQItem = {
  question: string;
  answer: string | React.ReactNode;
};

type FAQCategory = {
  id: string;
  title: string;
  items: FAQItem[];
};

export function HelpClient() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggleItem = (id: string) => {
    setOpenItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const scoutPlan = pricingPlans.find(p => p.id === 'scout');
  const trialDays = scoutPlan?.trialDays || 7;
  const scoutPrice = `${scoutPlan?.currency || '₹'}${scoutPlan?.price || 499}`;
  const scoutPeriod = scoutPlan?.period || 'month';

  const faqData: FAQCategory[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      items: [
        {
          question: 'What is AdsHunting?',
          answer: 'AdsHunting is an ad intelligence and creative research tool that brings ad discovery, review, organization, and sharing into one dedicated workflow.'
        },
        {
          question: 'Who is AdsHunting for?',
          answer: 'It is built for performance marketers, creative strategists, agencies, and D2C teams who need to research advertising creatives systematically.'
        },
        {
          question: `How does the ${trialDays}-day free trial work?`,
          answer: `You get full access to the core AdsHunting research workflow for ${trialDays} days. You can explore the search capabilities, build Swipe Files, and share ads with your team.`
        }
      ]
    },
    {
      id: 'discover-ads',
      title: 'Discover Ads',
      items: [
        {
          question: 'What can I search for?',
          answer: 'You can start your research with a brand name, a keyword, or a general research idea to discover relevant advertising creatives.'
        },
        {
          question: 'Which creative formats can I review?',
          answer: 'AdsHunting allows you to review supported observable formats including images, videos, carousels, and platform-specific layouts.'
        },
        {
          question: 'What information is shown with an ad?',
          answer: 'AdsHunting provides context such as the advertiser, ad status, creative format, primary text/caption, start date, and destination where available.'
        }
      ]
    },
    {
      id: 'ad-data',
      title: 'Ad Data & Metrics',
      items: [
        {
          question: 'Does AdsHunting provide ROAS, CTR, CPC, sales or revenue?',
          answer: (
            <span className="font-medium text-text-primary">
              No. Those are private advertiser metrics and are not provided through Meta&apos;s public advertising data sources. AdsHunting focuses strictly on observable ad and creative research information available through supported sources.
            </span>
          )
        },
        {
          question: 'Does a long-running ad mean it is profitable?',
          answer: 'No. Runtime can be a useful research signal, but it does not prove profitability, ROAS, conversions, or sales.'
        }
      ]
    },
    {
      id: 'swipe-files',
      title: 'Swipe Files',
      items: [
        {
          question: 'What are Swipe Files?',
          answer: 'Swipe Files are structured folders where you can save and organize the useful ad creatives you discover during your research.'
        },
        {
          question: 'Can I organize saved ads?',
          answer: 'Yes. You can organize them intentionally by competitor, format, hook, or any other structure that fits your workflow.'
        }
      ]
    },
    {
      id: 'shared-ads',
      title: 'Shared Ads',
      items: [
        {
          question: 'Can I share an ad?',
          answer: 'Yes. You can create share links so teammates, clients, or strategists can review the creative and its context.'
        },
        {
          question: 'Can I manage shared links?',
          answer: 'Yes. You can manage your active links and disable them when they are no longer needed.'
        },
        {
          question: 'Is login required to view a shared ad?',
          answer: 'You can create both public share links (which do not require login) and private/auth-gated share links depending on your needs.'
        }
      ]
    },
    {
      id: 'billing',
      title: 'Billing',
      items: [
        {
          question: 'How long is the free trial?',
          answer: `The free trial lasts for ${trialDays} days.`
        },
        {
          question: 'What does Scout cost?',
          answer: `The Scout plan is ${scoutPrice}/${scoutPeriod}.`
        },
        {
          question: 'Are Hunter and Agency available?',
          answer: 'Hunter and Agency plans are upcoming. Pricing and details will be announced soon.'
        }
      ]
    }
  ];

  // Search logic
  const filteredData = faqData.map(category => {
    const filteredItems = category.items.filter(item => 
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (typeof item.answer === 'string' && item.answer.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    return { ...category, items: filteredItems };
  }).filter(category => category.items.length > 0);

  return (
    <div className="max-w-[1040px] mx-auto">
      <div className="relative mb-16 md:mb-20 max-w-[640px] mx-auto">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-muted">
          <Search size={20} />
        </div>
        <input
          type="text"
          className="w-full pl-12 pr-4 py-4 rounded-[16px] border border-[#e4e8e2] bg-[#fcfcfa] shadow-sm text-[16px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
          placeholder="Search AdsHunting help..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search FAQ"
        />
      </div>

      {filteredData.length === 0 ? (
        <div className="text-center py-12 px-4 bg-[#fcfcfa] border border-[#e4e8e2] rounded-[16px]">
          <p className="text-[17px] text-text-secondary">No answers found for &quot;{searchQuery}&quot;.</p>
          <button 
            onClick={() => setSearchQuery('')}
            className="mt-4 text-brand font-medium hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-8 md:gap-16">
          {/* Category Navigation */}
          <div className="md:w-[240px] shrink-0">
            <nav className="flex overflow-x-auto md:overflow-visible pb-4 md:pb-0 gap-3 md:gap-1 md:flex-col md:sticky md:top-32 hide-scrollbar">
              {faqData.map(category => (
                <a 
                  key={`nav-${category.id}`} 
                  href={`#${category.id}`}
                  className="whitespace-nowrap px-4 py-2 md:py-3 md:px-4 rounded-full md:rounded-[8px] text-[14px] md:text-[15px] font-medium text-text-secondary hover:bg-[#f2f6f0] hover:text-brand transition-colors"
                >
                  {category.title}
                </a>
              ))}
            </nav>
          </div>

          {/* FAQ Content */}
          <div className="flex-1 min-w-0 space-y-16 md:space-y-20">
            {filteredData.map(category => (
              <div key={category.id} id={category.id} className="scroll-mt-32">
                <h2 className="text-[20px] md:text-[24px] font-bold text-text-primary mb-6">
                  {category.title}
                </h2>
                <div className="space-y-4">
                  {category.items.map((item, index) => {
                    const itemId = `${category.id}-${index}`;
                    const isOpen = !!openItems[itemId] || searchQuery.length > 2; // Auto-open if actively searching
                    
                    return (
                      <div 
                        key={index} 
                        className="border border-[#e4e8e2] rounded-[16px] bg-[#fcfcfa] overflow-hidden transition-all duration-200"
                      >
                        <button
                          onClick={() => toggleItem(itemId)}
                          className="w-full flex items-center justify-between p-5 md:p-6 text-left focus-visible:outline-none focus-visible:bg-[#f2f6f0]"
                          aria-expanded={isOpen}
                        >
                          <span className="text-[16px] md:text-[17px] font-bold text-text-primary pr-8 leading-snug">
                            {item.question}
                          </span>
                          <ChevronDown 
                            size={20} 
                            className={cn("text-text-muted transition-transform duration-200 shrink-0", isOpen && "rotate-180")} 
                          />
                        </button>
                        <div 
                          className={cn(
                            "overflow-hidden transition-all duration-200 ease-in-out",
                            isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                          )}
                        >
                          <div className="p-5 md:p-6 pt-0 text-[15px] md:text-[16px] text-text-secondary leading-relaxed">
                            {item.answer}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
