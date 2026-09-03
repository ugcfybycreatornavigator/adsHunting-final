'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown, Plus, Minus } from 'lucide-react';
import { AdsHuntingLogo } from '../../brand/AdsHuntingLogo';
import { CTAButton } from '../ui/CTAButton';
import { navigationConfig, authLinks } from '@/data/landing/config';
import { cn } from '@/lib/utils';

export function Navbar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<'product' | 'resources' | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<'product' | 'resources' | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setActiveDropdown(null);
      }
    }

    if (activeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [activeDropdown]);

  const toggleDropdown = (name: 'product' | 'resources') => {
    setActiveDropdown(activeDropdown === name ? null : name);
  };

  const toggleMobileAccordion = (name: 'product' | 'resources') => {
    setMobileExpanded(mobileExpanded === name ? null : name);
  };

  const closeMenus = () => {
    setIsMobileOpen(false);
    setActiveDropdown(null);
    setMobileExpanded(null);
  };

  return (
    <header className="fixed top-2 md:top-5 inset-x-0 z-50 transition-all duration-300 px-4 md:px-6">
      <div className="w-full max-w-[1200px] mx-auto bg-white/70 backdrop-blur-xl border border-black/[0.05] shadow-[0_8px_30px_rgba(94,169,32,0.08),0_1px_3px_rgba(0,0,0,0.02)] rounded-[20px] md:rounded-full">
        <div className="px-5 md:px-8">
          <div className="flex h-14 md:h-16 items-center justify-between">
          <Link href="/" onClick={closeMenus}>
            <AdsHuntingLogo size="md" />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6" ref={dropdownRef}>

            {/* Product Dropdown */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown('product')}
                aria-expanded={activeDropdown === 'product'}
                className="flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors focus:outline-none"
              >
                Product
                <ChevronDown size={14} className={cn("transition-transform duration-200", activeDropdown === 'product' && "rotate-180")} />
              </button>

              {activeDropdown === 'product' && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-surface border border-border shadow-lg rounded-2xl p-2 animate-in fade-in slide-in-from-top-2">
                  <div className="flex flex-col gap-1">
                    {navigationConfig.product.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={closeMenus}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-surface-subtle transition-colors"
                      >
                        <div className="mt-0.5 bg-surface-blue text-brand-strong p-1.5 rounded-lg">
                          <item.icon size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{item.name}</p>
                          <p className="text-xs text-text-secondary mt-0.5 leading-snug">{item.description}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Resources Dropdown */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown('resources')}
                aria-expanded={activeDropdown === 'resources'}
                className="flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors focus:outline-none"
              >
                Resources
                <ChevronDown size={14} className={cn("transition-transform duration-200", activeDropdown === 'resources' && "rotate-180")} />
              </button>

              {activeDropdown === 'resources' && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-surface border border-border shadow-lg rounded-2xl p-2 animate-in fade-in slide-in-from-top-2">
                  <div className="flex flex-col gap-1">
                    {navigationConfig.resources.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={closeMenus}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-surface-subtle transition-colors"
                      >
                        <div className="mt-0.5 bg-surface-subtle text-text-primary border border-border-strong p-1.5 rounded-lg">
                          <item.icon size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{item.name}</p>
                          <p className="text-xs text-text-secondary mt-0.5 leading-snug">{item.description}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Standard Links */}
            {navigationConfig.main.map((item) => (
              <Link key={item.name} href={item.href} className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <Link href={authLinks.signIn} className="text-sm font-medium text-text-primary hover:text-text-secondary">
              Sign In
            </Link>
            <CTAButton href={authLinks.signUp} size="sm">Start 7-Day Free Trial</CTAButton>
          </div>

          <button
            className="md:hidden p-2 text-text-secondary"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            aria-expanded={isMobileOpen}
            aria-label="Toggle menu"
          >
            {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
      </div>

      {/* Mobile Menu */}
      {isMobileOpen && (
        <div className="md:hidden border-t border-border bg-surface px-4 py-6 flex flex-col max-h-[calc(100vh-4rem)] overflow-y-auto">

          {/* Mobile Product Accordion */}
          <div className="border-b border-border/50">
            <button
              onClick={() => toggleMobileAccordion('product')}
              aria-expanded={mobileExpanded === 'product'}
              className="flex items-center justify-between w-full py-4 text-lg font-medium text-text-primary focus:outline-none"
            >
              Product
              {mobileExpanded === 'product' ? <Minus size={18} className="text-text-secondary" /> : <Plus size={18} className="text-text-secondary" />}
            </button>
            <div className={cn("overflow-hidden transition-all duration-300", mobileExpanded === 'product' ? "max-h-96 pb-4" : "max-h-0")}>
              <div className="flex flex-col gap-3 pl-2 border-l-2 border-border ml-2">
                {navigationConfig.product.map((item) => (
                  <Link key={item.name} href={item.href} onClick={closeMenus} className="text-[17px] text-text-secondary py-1">
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Resources Accordion */}
          <div className="border-b border-border/50">
            <button
              onClick={() => toggleMobileAccordion('resources')}
              aria-expanded={mobileExpanded === 'resources'}
              className="flex items-center justify-between w-full py-4 text-lg font-medium text-text-primary focus:outline-none"
            >
              Resources
              {mobileExpanded === 'resources' ? <Minus size={18} className="text-text-secondary" /> : <Plus size={18} className="text-text-secondary" />}
            </button>
            <div className={cn("overflow-hidden transition-all duration-300", mobileExpanded === 'resources' ? "max-h-96 pb-4" : "max-h-0")}>
              <div className="flex flex-col gap-3 pl-2 border-l-2 border-border ml-2">
                {navigationConfig.resources.map((item) => (
                  <Link key={item.name} href={item.href} onClick={closeMenus} className="text-[17px] text-text-secondary py-1">
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Standard Mobile Links */}
          {navigationConfig.main.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="py-4 border-b border-border/50 text-lg font-medium text-text-primary"
              onClick={closeMenus}
            >
              {item.name}
            </Link>
          ))}

          <div className="mt-6 flex flex-col gap-4">
            <Link
              href={authLinks.signIn}
              onClick={closeMenus}
              className="flex items-center justify-center w-full h-[52px] rounded-[14px] border border-[#e4e8e2] text-text-primary font-bold text-[16px] mb-3"
            >
              Sign In
            </Link>
            <CTAButton href={authLinks.signUp} size="lg" className="w-full">
              Start 7-Day Free Trial
            </CTAButton>
          </div>
        </div>
      )}
    </header>
  );
}
