'use client';

import React, { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

type FormStatus = 'idle' | 'sending' | 'success' | 'error';

export function ContactForm() {
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    topic: '',
    message: ''
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Full name is required';
    
    if (!formData.email.trim()) {
      newErrors.email = 'Work email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.topic) newErrors.topic = 'Please select a topic';
    
    if (!formData.message.trim() || formData.message.trim().length < 10) {
      newErrors.message = 'Please provide a meaningful message';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setStatus('sending');

    try {
      // Integration Boundary:
      // Replace this block with actual fetch() to your backend/API route
      const endpointConfigured = false; 
      
      if (!endpointConfigured) {
        // We simulate a network delay so the "Sending" state is visible briefly
        await new Promise(r => setTimeout(r, 600));
        throw new Error('Contact backend integration is not yet configured.');
      }

      // const response = await fetch('/api/contact', { ... })
      // if (!response.ok) throw new Error('Submission failed');
      
      setStatus('success');
    } catch (err) {
      console.error('Form submission error:', err);
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="bg-[#ffffff] border border-[#e4e8e2] rounded-[24px] p-[24px] lg:p-[36px] shadow-sm h-full flex flex-col items-center justify-center text-center min-h-[400px]">
        <h3 className="text-[24px] font-bold text-text-primary mb-3">Message sent.</h3>
        <p className="text-[16px] text-text-secondary max-w-[340px]">
          Thanks for getting in touch. We&apos;ll review your message.
        </p>
      </div>
    );
  }

  return (
    <form 
      onSubmit={handleSubmit} 
      className="bg-[#ffffff] border border-[#e4e8e2] rounded-[20px] lg:rounded-[24px] p-[20px] lg:p-[36px] shadow-sm flex flex-col h-full"
      noValidate
    >
      <div className="flex flex-col sm:flex-row gap-5 mb-5">
        <div className="flex-1">
          <label htmlFor="name" className="block text-[13px] font-bold text-text-primary mb-2">Full Name <span className="text-red-500">*</span></label>
          <input 
            type="text" 
            id="name" 
            name="name" 
            value={formData.name}
            onChange={handleChange}
            autoComplete="name"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            className={`w-full h-[48px] px-4 rounded-[12px] bg-white border ${errors.name ? 'border-red-300 ring-1 ring-red-100' : 'border-[#e4e8e2]'} focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all text-[15px]`}
            placeholder="Jane Doe"
          />
          {errors.name && <span id="name-error" className="text-red-500 text-[12px] mt-1.5 block">{errors.name}</span>}
        </div>
        
        <div className="flex-1">
          <label htmlFor="email" className="block text-[13px] font-bold text-text-primary mb-2">Work Email <span className="text-red-500">*</span></label>
          <input 
            type="email" 
            id="email" 
            name="email" 
            value={formData.email}
            onChange={handleChange}
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={`w-full h-[48px] px-4 rounded-[12px] bg-white border ${errors.email ? 'border-red-300 ring-1 ring-red-100' : 'border-[#e4e8e2]'} focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all text-[15px]`}
            placeholder="jane@company.com"
          />
          {errors.email && <span id="email-error" className="text-red-500 text-[12px] mt-1.5 block">{errors.email}</span>}
        </div>
      </div>

      <div className="mb-5">
        <label htmlFor="company" className="block text-[13px] font-bold text-text-primary mb-2">Company / Brand</label>
        <input 
          type="text" 
          id="company" 
          name="company" 
          value={formData.company}
          onChange={handleChange}
          autoComplete="organization"
          className="w-full h-[48px] px-4 rounded-[12px] bg-white border border-[#e4e8e2] focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all text-[15px]"
          placeholder="Optional"
        />
      </div>

      <div className="mb-5">
        <label htmlFor="topic" className="block text-[13px] font-bold text-text-primary mb-2">What can we help with? <span className="text-red-500">*</span></label>
        <select 
          id="topic" 
          name="topic" 
          value={formData.topic}
          onChange={handleChange}
          aria-invalid={!!errors.topic}
          aria-describedby={errors.topic ? "topic-error" : undefined}
          className={`w-full h-[48px] px-4 rounded-[12px] bg-white border ${errors.topic ? 'border-red-300 ring-1 ring-red-100' : 'border-[#e4e8e2]'} focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all text-[15px] appearance-none`}
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b7280\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center' }}
        >
          <option value="" disabled>Select a topic</option>
          <option value="Product question">Product question</option>
          <option value="Trial & pricing">Trial & pricing</option>
          <option value="Billing">Billing</option>
          <option value="Agency / team enquiry">Agency / team enquiry</option>
          <option value="Technical support">Technical support</option>
          <option value="Other">Other</option>
        </select>
        {errors.topic && <span id="topic-error" className="text-red-500 text-[12px] mt-1.5 block">{errors.topic}</span>}
      </div>

      <div className="mb-6 flex-1 flex flex-col">
        <label htmlFor="message" className="block text-[13px] font-bold text-text-primary mb-2">Message <span className="text-red-500">*</span></label>
        <textarea 
          id="message" 
          name="message" 
          value={formData.message}
          onChange={handleChange}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "message-error" : undefined}
          className={`w-full min-h-[140px] px-4 py-3 rounded-[12px] bg-white border flex-1 resize-y ${errors.message ? 'border-red-300 ring-1 ring-red-100' : 'border-[#e4e8e2]'} focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all text-[15px]`}
          placeholder="How can we help you?"
        ></textarea>
        {errors.message && <span id="message-error" className="text-red-500 text-[12px] mt-1.5 block">{errors.message}</span>}
      </div>

      {status === 'error' && (
        <div className="mb-6 p-4 rounded-[12px] bg-red-50 border border-red-100 flex items-start gap-3 text-left">
          <AlertCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
          <div>
            <span className="text-[14px] font-bold text-red-900 block mb-1">Message failed to send</span>
            <span className="text-[13.5px] text-red-800 leading-snug block">
              We couldn&apos;t send your message. Please try again or verify the backend integration is configured.
            </span>
          </div>
        </div>
      )}

      <button 
        type="submit" 
        disabled={status === 'sending'}
        className="w-full h-[52px] bg-brand text-white font-bold text-[16px] rounded-[14px] hover:bg-brand-hover transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {status === 'sending' ? (
          <><Loader2 size={18} className="animate-spin" /> Sending...</>
        ) : (
          'Send Message'
        )}
      </button>

    </form>
  );
}
