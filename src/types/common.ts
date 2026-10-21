import { ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'copper' | 'forest' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type BadgeVariant = 'forest' | 'copper' | 'stone' | 'obsidian' | 'neutral' | 'outline';
export type BadgeSize = 'sm' | 'md';

export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
}
