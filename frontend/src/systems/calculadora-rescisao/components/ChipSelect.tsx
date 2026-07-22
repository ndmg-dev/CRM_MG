import { cn } from '@calc/lib/utils';

interface ChipSelectProps<T extends string> {
  options: { value: T; label: string; description?: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function ChipSelect<T extends string>({ 
  options, 
  value, 
  onChange,
  disabled = false 
}: ChipSelectProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            'chip',
            value === option.value ? 'chip-active' : 'chip-inactive',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span>{option.label}</span>
          {option.description && (
            <span className="block text-xs opacity-70 mt-0.5">{option.description}</span>
          )}
        </button>
      ))}
    </div>
  );
}
