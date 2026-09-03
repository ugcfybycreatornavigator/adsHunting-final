'use client';

import React from 'react';
import { motion, Variants } from 'framer-motion';
import { LandingContainer } from '../layout/LandingContainer';
import { Search, Eye, Bookmark, Share2 } from 'lucide-react';

export function TrustProofSection() {
  const steps = [
    { icon: Search, label: 'Search' },
    { icon: Eye, label: 'Review' },
    { icon: Bookmark, label: 'Save' },
    { icon: Share2, label: 'Share' },
  ];
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 10, filter: 'blur(4px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.5, ease: "easeOut" }
    }
  };

  return (
    <section className="py-6 border-b border-border relative overflow-hidden">
      {/* Light Premium Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-white via-brand/5 to-white"></div>
      <div className="noise-texture absolute inset-0 opacity-[0.02]"></div>

      <LandingContainer className="relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-10"
        >
          <motion.span variants={itemVariants} className="text-[14px] font-bold tracking-widest uppercase text-text-primary">
            The Complete Intelligence Workflow
          </motion.span>
          <div className="flex items-center gap-4 md:gap-8">
            {steps.map((step, index) => (
              <React.Fragment key={step.label}>
                <motion.div variants={itemVariants} className="flex items-center gap-2 group cursor-default">
                  <step.icon size={18} className="text-text-muted group-hover:text-brand transition-colors duration-300" />
                  <span className="text-[15px] font-medium text-text-secondary group-hover:text-text-primary transition-colors duration-300">{step.label}</span>
                </motion.div>
                {index < steps.length - 1 && (
                  <motion.div variants={itemVariants} className="w-1.5 h-1.5 rounded-full bg-border-strong hidden sm:block"></motion.div>
                )}
              </React.Fragment>
            ))}
          </div>
        </motion.div>
      </LandingContainer>
    </section>
  );
}
