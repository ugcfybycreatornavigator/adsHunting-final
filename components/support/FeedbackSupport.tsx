"use client";
import { apiFetch } from "@/lib/api-client";

import { useState, useRef, useEffect } from "react";
import { Loader2, Paperclip, Send, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui";
import { useSupport, FeedbackType } from "./support-context";
import { supportConfig } from "@/lib/support/config";
import { cn } from "@/lib/utils";

const feedbackTypes: FeedbackType[] = [
  "Bug",
  "Feature request",
  "Data issue",
  "Billing",
  "Account",
  "General feedback",
  "Other"
];

const getPlaceholder = (type: FeedbackType) => {
  switch (type) {
    case "Bug": return "What happened, and what did you expect instead?";
    case "Feature request": return "What would you like AdsHunting to do?";
    case "Data issue": return "What data looks incorrect or incomplete?";
    default: return "Please describe your feedback or issue.";
  }
};

export function FeedbackSupport() {
  const { feedbackType: initialType, supportContext, closeSupport } = useSupport();
  const [type, setType] = useState<FeedbackType>(initialType || "Bug");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [validationError, setValidationError] = useState("");
  const [referenceId, setReferenceId] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Focus message on mount if not mobile
  useEffect(() => {
    if (window.innerWidth > 640) {
      document.getElementById("feedback-message")?.focus();
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setValidationError("");
    
    // Validate size
    if (file.size > supportConfig.feedbackMaxAttachmentSizeMB * 1024 * 1024) {
      setValidationError(`File is too large. Maximum size is ${supportConfig.feedbackMaxAttachmentSizeMB}MB.`);
      return;
    }

    // Validate type (basic client side)
    const validTypes = ["image/png", "image/jpeg", "image/webp", "video/mp4"];
    if (!validTypes.includes(file.type)) {
      setValidationError("Invalid file type. Please upload a PNG, JPG, WEBP, or MP4.");
      return;
    }

    setAttachment(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");
    setErrorMessage("");

    if (!message.trim()) {
      setValidationError("Please tell us what happened.");
      document.getElementById("feedback-message")?.focus();
      return;
    }

    if (message.trim().length > 5000) {
      setValidationError("Message is too long. Please keep it under 5000 characters.");
      return;
    }

    setStatus("submitting");

    try {
      const formData = new FormData();
      formData.append("type", type);
      formData.append("message", message.trim());
      
      // Add context safely
      const safeContext = {
        page: supportContext?.page || window.location.pathname,
        requestId: supportContext?.requestId,
        userAgent: window.navigator.userAgent,
      };
      formData.append("context", JSON.stringify(safeContext));

      if (attachment) {
        formData.append("attachment", attachment);
      }

      const response = await apiFetch("/api/feedback", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit feedback");
      }

      setReferenceId(data.id || "");
      setStatus("success");
    } catch (err) {
      setStatus("error");
      if (err instanceof Error) {
        setErrorMessage(err.message || "An unexpected error occurred. Please try again.");
      } else {
        setErrorMessage("An unexpected error occurred. Please try again.");
      }
    }
  };

  const resetForm = () => {
    setMessage("");
    setAttachment(null);
    setStatus("idle");
    setErrorMessage("");
    setValidationError("");
    setReferenceId("");
  };

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="flex size-16 items-center justify-center rounded-full bg-brand/10 text-brand mb-6">
          <CheckCircle2 size={32} strokeWidth={1.5} />
        </div>
        <h3 className="text-xl font-semibold text-ink">Thanks — your feedback has been sent.</h3>
        {referenceId && (
          <p className="mt-2 text-sm text-muted">
            Reference #{referenceId.slice(0, 8).toUpperCase()}
          </p>
        )}
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={resetForm}>
            Send another
          </Button>
          <Button variant="primary" onClick={closeSupport}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Type Selection */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="feedback-type" className="text-sm font-semibold text-ink">
          What kind of feedback is this?
        </label>
        <select
          id="feedback-type"
          value={type}
          onChange={(e) => setType(e.target.value as FeedbackType)}
          className="h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand disabled:opacity-50 transition-shadow"
          disabled={status === "submitting"}
        >
          {feedbackTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Message Textarea */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="feedback-message" className="text-sm font-semibold text-ink">
          Message
        </label>
        <textarea
          id="feedback-message"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (validationError && e.target.value.trim()) setValidationError("");
          }}
          placeholder={getPlaceholder(type)}
          rows={5}
          className={cn(
            "w-full resize-none rounded-lg border px-3 py-3 text-sm text-ink outline-none transition-shadow",
            validationError ? "border-signal focus:border-signal focus:ring-1 focus:ring-signal" : "border-line focus:border-brand focus:ring-1 focus:ring-brand",
            "disabled:opacity-50"
          )}
          disabled={status === "submitting"}
        />
        {validationError && (
          <p className="text-xs font-medium text-signal mt-1">{validationError}</p>
        )}
      </div>

      {/* Attachment */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-ink">
          Attachment <span className="text-muted font-normal">(optional)</span>
        </label>
        
        {attachment ? (
          <div className="flex items-center justify-between rounded-lg border border-line bg-surface/50 px-3 py-2">
            <div className="flex items-center gap-2 overflow-hidden">
              <Paperclip size={16} className="text-muted shrink-0" />
              <span className="truncate text-sm font-medium text-ink">{attachment.name}</span>
              <span className="text-xs text-muted shrink-0">
                ({(attachment.size / 1024 / 1024).toFixed(1)} MB)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-signal transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              disabled={status === "submitting"}
              aria-label="Remove attachment"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center">
            <input
              type="file"
              id="feedback-attachment"
              ref={fileInputRef}
              className="sr-only"
              accept="image/png,image/jpeg,image/webp,video/mp4"
              onChange={handleFileChange}
              disabled={status === "submitting"}
            />
            <Button
              type="button"
              variant="secondary"
              className="h-10 text-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={status === "submitting"}
            >
              <Paperclip size={16} />
              Add screenshot or video
            </Button>
          </div>
        )}
        <p className="text-xs text-muted">
          PNG, JPG, WEBP, or MP4 up to {supportConfig.feedbackMaxAttachmentSizeMB}MB.
        </p>
      </div>

      {/* Error Message */}
      {status === "error" && errorMessage && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-signal">
          {errorMessage}
        </div>
      )}

      {/* Actions */}
      <div className="mt-2 flex justify-end gap-3 pt-4 border-t border-line">
        <Button
          type="button"
          variant="ghost"
          onClick={closeSupport}
          disabled={status === "submitting"}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={status === "submitting"}
        >
          {status === "submitting" ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send size={16} />
              Submit feedback
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
