import { useState, useEffect } from 'react';
import { format, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@calc/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@calc/components/ui/popover';
import { cn } from '@calc/lib/utils';

interface DateInputProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  className?: string;
}

export function DateInput({ value, onChange, placeholder = 'dd/mm/aaaa', className }: DateInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Sync input value with prop value
  useEffect(() => {
    if (value && isValid(value)) {
      setInputValue(format(value, 'dd/MM/yyyy'));
    } else {
      setInputValue('');
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    
    // Apply mask dd/mm/yyyy
    if (val.length > 2) {
      val = val.slice(0, 2) + '/' + val.slice(2);
    }
    if (val.length > 5) {
      val = val.slice(0, 5) + '/' + val.slice(5);
    }
    if (val.length > 10) {
      val = val.slice(0, 10);
    }
    
    setInputValue(val);
    
    // Try to parse date when complete
    if (val.length === 10) {
      const parsed = parse(val, 'dd/MM/yyyy', new Date());
      if (isValid(parsed)) {
        onChange(parsed);
      }
    } else if (val === '') {
      onChange(null);
    }
  };

  const handleBlur = () => {
    // On blur, validate and sync
    if (inputValue.length === 10) {
      const parsed = parse(inputValue, 'dd/MM/yyyy', new Date());
      if (isValid(parsed)) {
        onChange(parsed);
      } else {
        // Reset to previous valid value
        if (value && isValid(value)) {
          setInputValue(format(value, 'dd/MM/yyyy'));
        } else {
          setInputValue('');
        }
      }
    } else if (inputValue !== '') {
      // Incomplete date, reset
      if (value && isValid(value)) {
        setInputValue(format(value, 'dd/MM/yyyy'));
      } else {
        setInputValue('');
      }
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      onChange(date);
      setInputValue(format(date, 'dd/MM/yyyy'));
    }
    setIsOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="input-dark w-full pr-10"
          />
          <PopoverTrigger asChild>
            <button 
              type="button"
              className="absolute right-0 top-0 h-full px-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <CalendarIcon className="w-4 h-4" />
            </button>
          </PopoverTrigger>
        </div>
        <PopoverContent
          className="w-auto p-0 bg-card border-border"
          align="start"
          side="bottom"
          sideOffset={4}
          avoidCollisions={false}
        >
          <Calendar
            mode="single"
            selected={value || undefined}
            onSelect={handleCalendarSelect}
            locale={ptBR}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
