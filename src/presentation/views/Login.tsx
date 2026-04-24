import { ShieldCheck, Database, ArrowRight, Heart, ChevronDown, Cloud, Lock, Smartphone } from 'lucide-react';
import { useBudget } from '../context/BudgetContext';
import { useState, useRef } from 'react';
import { BudgetExplainer } from '../components/BudgetExplainer';

export default function Login() {
  const { login } = useBudget();
  const [loading, setLoading] = useState(false);
  const privacyRef = useRef<HTMLDivElement>(null);
  const methodologyRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleLogin = async (provider: 'google' | 'onedrive') => {
    setLoading(true);
    try {
      await login(provider);
    } catch (error) {
      console.error('Login failed', error);
      alert('Error al iniciar sesión. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const scrollToPrivacy = () => {
    privacyRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToMethodology = () => {
    methodologyRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div ref={containerRef} className="h-screen overflow-y-auto overflow-x-hidden scroll-smooth snap-y snap-mandatory scroll-pt-10 bg-gray-50 text-gray-900">
      {/* SECTION 1: HERO & LOGIN */}
      <section className="min-h-screen w-full flex flex-col items-center justify-center p-6 py-12 md:h-screen md:py-6 relative snap-start snap-always shrink-0">
        {/* Decorative Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/5 blur-[100px] rounded-full" />

        <div className="w-full max-w-lg relative animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="text-center mb-10 space-y-4">
            <div className="inline-flex p-2 rounded-[2.5rem] bg-white shadow-xl shadow-indigo-100/50 border border-indigo-50 mb-4 overflow-hidden">
              <img src="/logo_full.png" className="w-24 h-24 sm:w-32 sm:h-32 object-contain" alt="Bagi Logo" />
            </div>
            <p className="text-gray-500 text-lg font-bold max-w-xs mx-auto leading-tight">
              Gestión financiera personal <br/> protegida por tu propia nube.
            </p>
          </div>

          <div className="bg-white border border-gray-100 p-8 rounded-[3rem] shadow-2xl shadow-gray-200/50 space-y-8">
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-6">Acceder al Presupuesto</h2>
              </div>
              
              <button
                onClick={() => handleLogin('google')}
                disabled={loading}
                className="group relative flex items-center justify-between p-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition-all duration-500 transform hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-100 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed w-full max-w-sm mx-auto"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm">
                    <img src="https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png" className="w-6 h-6" alt="Google" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-white text-sm">Google Drive</p>
                    <p className="text-[9px] text-indigo-100 font-bold uppercase tracking-widest mt-0.5">Conectar nube segura</p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:bg-white group-hover:text-indigo-600 transition-all duration-500">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            </div>

            <div className="pt-8 border-t border-gray-50 grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
              <div className="space-y-3 p-4 bg-indigo-50/50 rounded-3xl border border-indigo-100/50 hover:bg-indigo-50 transition-colors group">
                  <div className="flex justify-center text-indigo-600 bg-white w-10 h-10 mx-auto rounded-xl items-center shadow-sm group-hover:scale-110 transition-transform"><ShieldCheck className="w-5 h-5" /></div>
                  <div>
                    <p className="text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-1">Privacidad Total</p>
                    <p className="text-[9px] text-indigo-600/70 font-bold leading-tight">Acceso exclusivo</p>
                  </div>
              </div>
              <div className="space-y-3 p-4 bg-emerald-50/50 rounded-3xl border border-emerald-100/50 hover:bg-emerald-50 transition-colors group">
                  <div className="flex justify-center text-emerald-600 bg-white w-10 h-10 mx-auto rounded-xl items-center shadow-sm group-hover:scale-110 transition-transform"><Database className="w-5 h-5" /></div>
                  <div>
                    <p className="text-[10px] font-black text-emerald-900 uppercase tracking-widest mb-1">Tus Datos</p>
                    <p className="text-[9px] text-emerald-600/70 font-bold leading-tight">Sin servidores centrales</p>
                  </div>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center gap-2 animate-bounce cursor-pointer" onClick={scrollToMethodology}>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">¿Cómo funciona?</p>
            <ChevronDown className="w-5 h-5 text-indigo-300" />
          </div>
        </div>
      </section>

      {/* SECTION 2: BUDGET METHODOLOGY */}
      <section ref={methodologyRef} className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-white snap-start snap-always shrink-0 relative py-32">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent" />
        
        <div className="max-w-6xl w-full space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-sm font-black text-indigo-600 uppercase tracking-[0.4em]">La Metodología</h2>
            <h3 className="text-5xl font-black text-gray-900 tracking-tighter">Diseñado para darte claridad real.</h3>
          </div>

          <BudgetExplainer />

          <div className="flex flex-col items-center gap-4 pt-12">
            <div className="flex flex-col items-center gap-2 animate-bounce cursor-pointer" onClick={scrollToPrivacy}>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Privacidad y Seguridad</p>
              <ChevronDown className="w-5 h-5 text-indigo-300" />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: PRIVACY & SECURITY */}
      <section ref={privacyRef} className="min-h-screen w-full flex flex-col items-center justify-center p-6 py-20 bg-gray-50 snap-start snap-always shrink-0 relative">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent" />
        
        <div className="max-w-4xl w-full space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-sm font-black text-indigo-600 uppercase tracking-[0.4em]">Tu Privacidad es Primero</h2>
            <h3 className="text-4xl font-black text-gray-900 tracking-tighter">Tú tienes el control absoluto de tu información.</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 space-y-6 hover:shadow-2xl hover:shadow-indigo-100/30 transition-all duration-500 group">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition-transform">
                <Smartphone className="w-7 h-7" />
              </div>
              <div className="space-y-3">
                <h4 className="text-xl font-bold text-gray-800 tracking-tight">Privacidad Local</h4>
                <p className="text-sm text-gray-500 leading-relaxed font-medium">
                  Tus transacciones viven en una base de datos local en tu dispositivo. Bagi <b>no almacena</b> tu información en servidores propios ni tiene acceso a tus datos financieros.
                </p>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 space-y-6 hover:shadow-2xl hover:shadow-indigo-100/30 transition-all duration-500 group">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm group-hover:scale-110 transition-transform">
                <Cloud className="w-7 h-7" />
              </div>
              <div className="space-y-3">
                <h4 className="text-xl font-bold text-gray-800 tracking-tight">Sincronización Directa</h4>
                <p className="text-sm text-gray-500 leading-relaxed font-medium">
                  Bagi utiliza tu cuenta de <b>Google Drive</b> como bóveda de seguridad. La sincronización es directa entre tu dispositivo y tu nube, sin intermediarios.
                </p>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 space-y-6 hover:shadow-2xl hover:shadow-indigo-100/30 transition-all duration-500 group">
              <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 shadow-sm group-hover:scale-110 transition-transform">
                <Lock className="w-7 h-7" />
              </div>
              <div className="space-y-3">
                <h4 className="text-xl font-bold text-gray-800 tracking-tight">Control Total</h4>
                <p className="text-sm text-gray-500 leading-relaxed font-medium">
                  No existen bases de datos centrales. Tú eres el único dueño de tu información.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-8 flex flex-col items-center gap-6">
            <button 
              onClick={scrollToTop}
              className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold text-sm tracking-widest uppercase hover:bg-gray-800 transition-all shadow-xl shadow-gray-200 cursor-pointer active:scale-95"
            >
              ¡Entendido, vamos!
            </button>
            
            <div className="flex items-center justify-center space-x-2 text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
              <span>Hecho con el</span>
              <Heart className="w-3 h-3 text-rose-500 fill-rose-500 animate-pulse" />
              <span>por devlusaja</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
