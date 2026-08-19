import React from 'react';
import logoMendoncaGalvao from '@aeronord/assets/logo-mendonca-galvao.png';

export function Header() {
  return (
    <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 md:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Logo Mendonça Galvão */}
            <img 
              src={logoMendoncaGalvao} 
              alt="Mendonça Galvão - Contadores Associados" 
              className="h-10 md:h-16 w-auto object-contain no-print"
            />
            <div>
              <h1 className="font-display text-2xl md:text-4xl text-foreground tracking-wider">
                CONVOCAÇÕES <span className="text-primary">&</span> RECIBOS
              </h1>
              <p className="text-foreground-muted text-xs md:text-sm mt-0.5">
                Cálculo automático + impressão padronizada
              </p>
            </div>
          </div>

          {/* Decorative element */}
          <div className="hidden md:flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse-gold" />
            <div className="w-16 h-px bg-gradient-to-r from-primary to-transparent" />
          </div>
        </div>
      </div>
    </header>
  );
}
