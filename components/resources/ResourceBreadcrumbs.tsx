import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export function ResourceBreadcrumbs({
  title,
}: {
  title: string;
}) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2 text-sm text-text-muted">
        <li>
          <Link href="/" className="hover:text-text-primary transition-colors">
            Home
          </Link>
        </li>
        <li className="flex items-center space-x-2">
          <ChevronRight size={14} />
          <Link href="/resources" className="hover:text-text-primary transition-colors">
            Resources
          </Link>
        </li>
        <li className="flex items-center space-x-2">
          <ChevronRight size={14} />
          <span className="text-text-primary font-medium truncate max-w-[200px] md:max-w-none" aria-current="page">
            {title}
          </span>
        </li>
      </ol>
    </nav>
  );
}
