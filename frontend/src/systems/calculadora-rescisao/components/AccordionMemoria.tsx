import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@calc/lib/utils';

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function AccordionItem({ title, children, defaultOpen = false }: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-background-subtle hover:bg-card transition-colors"
      >
        <span className="font-medium text-foreground">{title}</span>
        <ChevronDown 
          className={cn(
            'h-5 w-5 text-muted-foreground transition-transform',
            isOpen && 'rotate-180'
          )} 
        />
      </button>
      {isOpen && (
        <div className="px-4 py-4 bg-card-alt border-t border-border animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

interface AccordionGroupProps {
  children: React.ReactNode;
}

export function AccordionGroup({ children }: AccordionGroupProps) {
  return <div className="space-y-3">{children}</div>;
}
