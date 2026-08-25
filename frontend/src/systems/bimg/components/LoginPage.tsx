import { useState } from 'react';
import { supabase } from '../lib/supabase';
import logoPic from '../assets/logo.png';

interface LoginPageProps {
  errorMsg?: string | null;
}

// Login próprio do BIMG via Google OAuth do Supabase. Diferente do Copilot
// Contábil (que confia inteiramente na sessão unificada / SSO estabelecida no
// login do CRM), o BIMG original também expõe este fluxo de login "manual"
// como fallback — útil caso o SSO (signInWithIdToken em unifiedAuth.ts) ainda
// não tenha rodado ou falhe (ex.: variável de ambiente ausente naquele
// momento). Mantido para paridade com o app original.
export default function LoginPage({ errorMsg }: LoginPageProps) {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.href,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
          hd: 'mendoncagalvao.com.br', // Google workspace hosted domain hint
        },
      },
    });

    if (error) {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c0c] flex flex-col justify-center items-center p-4">
      <div className="bg-[#111111] border border-[#27272a] rounded-xl p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-[#d4af37]"></div>

        <div className="mb-8 flex flex-col items-center">
          <img src={logoPic} alt="Mendonça Galvão" width={140} height={140} className="mb-4 object-contain" />
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            B.I Solutions <span className="text-[#D4AF37]">MG</span>
          </h1>
          <p className="text-[#a1a1aa] text-sm">Painel Executivo Restrito</p>
        </div>

        {errorMsg && (
          <div className="bg-[#f43f5e]/10 border border-[#f43f5e]/50 text-[#f43f5e] text-xs p-3 rounded-lg mb-6">
            {errorMsg}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-black font-semibold rounded-lg text-sm px-5 py-3 transition-colors disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {loading ? 'Redirecionando...' : 'Entrar com Google Workspace'}
        </button>

        <p className="mt-6 text-[#71717a] text-xs">
          O acesso requer um e-mail institucional autorizado @mendoncagalvao.com.br
        </p>
      </div>
    </div>
  );
}
