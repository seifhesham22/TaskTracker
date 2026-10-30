import type { ReactNode } from 'react';
import './PageHeader.css';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}

/** Page title block; renders the page's single h1. */
export function PageHeader({ eyebrow, title, children }: PageHeaderProps) {
  return (
    <header className="page-header">
      {eyebrow && <p className="page-header__eyebrow">{eyebrow}</p>}
      <h1 className="page-header__title">{title}</h1>
      {children && <div className="page-header__lead">{children}</div>}
    </header>
  );
}
