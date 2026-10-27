import type { ReactNode } from 'react';
import './Card.css';

interface CardProps {
  title?: string;
  className?: string;
  children: ReactNode;
}

export function Card({ title, className, children }: CardProps) {
  return (
    <section className={className ? `card ${className}` : 'card'}>
      {title && <h2 className="card__title">{title}</h2>}
      {children}
    </section>
  );
}
