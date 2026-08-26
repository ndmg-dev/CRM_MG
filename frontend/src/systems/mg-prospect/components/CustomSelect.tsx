import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

interface SelectOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
    badge?: string;
    badgeClass?: string;
}

interface CustomSelectProps {
    options: SelectOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    icon?: React.ReactNode;
    searchable?: boolean;
    minWidth?: string;
    className?: string;
}

export function CustomSelect({
    options,
    value,
    onChange,
    placeholder = 'Selecionar...',
    icon,
    searchable = false,
    minWidth = '200px',
    className = '',
}: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(o => o.value === value);

    const filteredOptions = searchable && search
        ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
        : options;

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearch('');
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus search on open
    useEffect(() => {
        if (isOpen && searchable && searchRef.current) {
            searchRef.current.focus();
        }
        if (isOpen) {
            setHighlightIndex(-1);
        }
    }, [isOpen, searchable]);

    // Scroll highlighted item into view
    useEffect(() => {
        if (highlightIndex >= 0 && listRef.current) {
            const items = listRef.current.querySelectorAll('[data-option]');
            items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
        }
    }, [highlightIndex]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightIndex(prev =>
                    prev < filteredOptions.length - 1 ? prev + 1 : 0
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightIndex(prev =>
                    prev > 0 ? prev - 1 : filteredOptions.length - 1
                );
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightIndex >= 0 && filteredOptions[highlightIndex]) {
                    onChange(filteredOptions[highlightIndex].value);
                    setIsOpen(false);
                    setSearch('');
                }
                break;
            case 'Escape':
                setIsOpen(false);
                setSearch('');
                break;
        }
    };

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearch('');
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setIsOpen(false);
    };

    return (
        <div
            ref={containerRef}
            className={`relative ${className}`}
            style={{ minWidth }}
            onKeyDown={handleKeyDown}
        >
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full flex items-center gap-2.5 px-3.5 py-2.5
                    bg-mg-surface border rounded-premium text-sm font-medium
                    transition-all duration-200 cursor-pointer text-left
                    ${isOpen
                        ? 'border-mg-gold/50 ring-1 ring-mg-gold/20 shadow-[0_0_12px_rgba(212,175,55,0.08)]'
                        : 'border-mg-border hover:border-mg-borderbold'
                    }
                    ${value ? 'text-mg-text' : 'text-mg-muted'}
                `}
            >
                {icon && (
                    <span className={`flex-shrink-0 transition-colors duration-200 ${isOpen ? 'text-mg-gold' : 'text-mg-muted'}`}>
                        {icon}
                    </span>
                )}
                <span className="flex-1 truncate">
                    {selectedOption?.label || placeholder}
                </span>
                {value && (
                    <span
                        onClick={handleClear}
                        className="flex-shrink-0 p-0.5 rounded hover:bg-mg-elevated text-mg-muted hover:text-mg-text transition-colors"
                    >
                        <X className="w-3 h-3" />
                    </span>
                )}
                <ChevronDown className={`w-4 h-4 flex-shrink-0 text-mg-muted transition-transform duration-200 ${isOpen ? 'rotate-180 text-mg-gold' : ''}`} />
            </button>

            {/* Dropdown Panel */}
            <div
                className={`
                    absolute z-50 top-full left-0 right-0 mt-1.5
                    bg-[#0F1215] border border-mg-border/80 rounded-premium-lg
                    shadow-[0_12px_40px_-8px_rgba(0,0,0,0.6),0_0_0_1px_rgba(212,175,55,0.05)]
                    backdrop-blur-xl overflow-hidden
                    transition-all duration-200 origin-top
                    ${isOpen
                        ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                        : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
                    }
                `}
            >
                {/* Search input */}
                {searchable && (
                    <div className="p-2 border-b border-mg-border/50">
                        <input
                            ref={searchRef}
                            type="text"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setHighlightIndex(0); }}
                            placeholder="Filtrar..."
                            className="w-full px-3 py-1.5 bg-mg-bg/80 border border-mg-border/50 rounded-md text-sm text-mg-text placeholder:text-mg-muted/50 outline-none focus:border-mg-gold/30 transition-colors"
                        />
                    </div>
                )}

                {/* Options list */}
                <div ref={listRef} className="max-h-[220px] overflow-y-auto custom-scrollbar py-1">
                    {filteredOptions.length === 0 ? (
                        <div className="px-3.5 py-4 text-center text-xs text-mg-muted/60">
                            Nenhum resultado encontrado
                        </div>
                    ) : (
                        filteredOptions.map((option, idx) => {
                            const isSelected = option.value === value;
                            const isHighlighted = idx === highlightIndex;

                            return (
                                <button
                                    key={option.value}
                                    data-option
                                    type="button"
                                    onClick={() => handleSelect(option.value)}
                                    className={`
                                        w-full flex items-center gap-2.5 px-3.5 py-2.5
                                        text-sm text-left transition-all duration-100
                                        ${isSelected
                                            ? 'text-mg-gold bg-mg-gold/8'
                                            : isHighlighted
                                                ? 'text-mg-text bg-mg-elevated/80'
                                                : 'text-mg-sub hover:text-mg-text hover:bg-mg-elevated/50'
                                        }
                                    `}
                                >
                                    {option.icon && (
                                        <span className={`flex-shrink-0 ${isSelected ? 'text-mg-gold' : 'text-mg-muted'}`}>
                                            {option.icon}
                                        </span>
                                    )}
                                    <span className="flex-1 truncate font-medium">{option.label}</span>
                                    {option.badge && (
                                        <span className={`text-2xs px-1.5 py-0.5 rounded-full font-semibold ${option.badgeClass || 'bg-mg-elevated text-mg-muted'}`}>
                                            {option.badge}
                                        </span>
                                    )}
                                    {isSelected && (
                                        <Check className="w-3.5 h-3.5 text-mg-gold flex-shrink-0" />
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
