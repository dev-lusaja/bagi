import { ArrowRight, Heart, ChevronDown, Cloud, Lock, Smartphone, Mic, Bot, AlertCircle, FlaskConical } from 'lucide-react';
import { useBudget } from '../context/BudgetContext';
import { useState, useRef } from 'react';
import { BudgetExplainer } from '../components/BudgetExplainer';
import AlertModal from '../components/AlertModal';
import { ErrorLogger } from '../../services/SentryLogger';

function GoogleLoginButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group relative flex items-center justify-between p-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition-all duration-500 transform hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-100 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed w-full max-w-sm mx-auto"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm">
          <img src="https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png" className="w-6 h-6" alt="" />
        </div>
        <span className="font-bold text-white text-sm">Continuar con Google</span>
      </div>
      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:bg-white group-hover:text-indigo-600 transition-all duration-500">
        <ArrowRight className="w-4 h-4" />
      </div>
    </button>
  );
}

export default function Login() {
  const { login, loginDemo, sessionExpired } = useBudget();
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [authIncomplete, setAuthIncomplete] = useState(false);
  const privacyRef = useRef<HTMLDivElement>(null);
  const methodologyRef = useRef<HTMLDivElement>(null);
  const aiRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string; type: 'info' | 'error' | 'success' }>({
    isOpen: false, title: '', message: '', type: 'info'
  });

  const showAlert = (title: string, message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setAlertConfig({ isOpen: true, title, message, type });
  };

  const handleLogin = async (provider: 'google' | 'onedrive') => {
    setLoading(true);
    setAuthIncomplete(false);
    try {
      await login(provider);
    } catch (error: any) {
      ErrorLogger.capture(error, { source: 'Login - handleLogin' });
      if (error?.message === 'NO_CLIENT_ID') {
        showAlert(
          'Configuración Pendiente',
          'Las credenciales de Google OAuth (VITE_GOOGLE_CLIENT_ID) no están configuradas en las variables de entorno. Puedes explorar toda la aplicación usando el "Modo Demo".',
          'info'
        );
      } else if (error?.error === 'popup_closed_by_user' || error?.type === 'popup_closed' || error?.type === 'popup_failed_to_open') {
        setAuthIncomplete(true);
      } else {
        showAlert('Error de acceso', 'No pudimos conectar con tu cuenta de Google. Verifica tu conexión o intenta con el "Modo Demo".', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const scrollToMethodology = () => {
    methodologyRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div ref={containerRef} className="h-screen overflow-y-auto overflow-x-hidden scroll-smooth scroll-pt-10 bg-gray-50 text-gray-900">
      {/* SECTION 1: HERO & LOGIN */}
      <section className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 py-8 md:h-screen md:py-6 relative shrink-0">
        {/* Decorative Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/5 blur-[100px] rounded-full" />

        <div className="w-full max-w-lg relative animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="text-center mb-6 sm:mb-10 space-y-3 sm:space-y-4">
            <div className="inline-flex p-2 rounded-[2.5rem] bg-white shadow-xl shadow-indigo-100/50 border border-indigo-50 mb-2 sm:mb-4 overflow-hidden">
              <img src="/logo_full.png" className="w-20 h-20 sm:w-32 sm:h-32 object-contain" alt="Bagi Logo" />
            </div>
            <p className="text-gray-500 text-base sm:text-lg font-bold max-w-xs mx-auto leading-tight">
              Tus finanzas personales, en tu propia nube.
            </p>
          </div>

          <div className="bg-white border border-gray-100 p-5 sm:p-8 rounded-2xl sm:rounded-[3rem] shadow-2xl shadow-gray-200/50">
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-[10px] font-black text-gray-400 mb-6">Acceder al presupuesto</h2>
              </div>

              {(sessionExpired || authIncomplete) && (
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl flex items-start gap-3 text-sm animate-in fade-in slide-in-from-top-2 duration-300 w-full max-w-sm mx-auto">
                  <AlertCircle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
                  <div className="text-left">
                    {sessionExpired ? (
                      <>
                        <p className="font-bold">Tu sesión ha expirado</p>
                        <p className="text-xs text-amber-700/80 font-medium mt-0.5">
                          Por seguridad, tu conexión con Google Drive se ha cerrado. Vuelve a iniciar sesión para continuar.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-bold">Inicio de sesión incompleto</p>
                        <p className="text-xs text-amber-700/80 font-medium mt-0.5">
                          Cerraste la ventana de Google antes de terminar. Completa la autenticación con Google para continuar.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              <GoogleLoginButton onClick={() => handleLogin('google')} disabled={loading || demoLoading} />

              <div className="text-center pt-2">
                <button
                  onClick={async () => {
                    setDemoLoading(true);
                    try {
                      await loginDemo();
                    } catch (e) {
                      ErrorLogger.capture(e, { source: 'Login - demo' });
                    } finally {
                      setDemoLoading(false);
                    }
                  }}
                  disabled={loading || demoLoading}
                  className="inline-flex items-center justify-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors py-2 px-3 rounded-xl hover:bg-indigo-50/50 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <FlaskConical className="w-3.5 h-3.5 text-indigo-500 group-hover:scale-110 transition-transform" />
                  <span className="underline decoration-indigo-300 underline-offset-4 group-hover:decoration-indigo-600">
                    Probar en modo demo
                  </span>
                </button>
              </div>
            </div>

          </div>
          <div className="mt-12 flex justify-center cursor-pointer opacity-40 hover:opacity-100 transition-opacity" onClick={scrollToMethodology}>
            <ChevronDown className="w-6 h-6 text-indigo-400 animate-bounce" />
          </div>
        </div>
      </section>

      {/* SECTION 2: BUDGET METHODOLOGY */}
      <section ref={methodologyRef} className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-white shrink-0 relative py-32">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent" />

        <div className="max-w-6xl w-full space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-sm font-black text-indigo-600">La metodología</h2>
            <h3 className="text-5xl font-black text-gray-900 tracking-tighter">Sin intermediarios. <span className="text-indigo-600">Solo tú y tus finanzas.</span></h3>
          </div>

          <BudgetExplainer />

        </div>
      </section>

      {/* SECTION 3: BAGI IA */}
      <section ref={aiRef} className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-gray-50 shrink-0 relative py-32">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent" />

        <div className="max-w-4xl w-full space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-sm font-black text-indigo-600">Conoce a Bagi IA</h2>
            <h3 className="text-4xl font-black text-gray-900 tracking-tighter">Tu asistente financiero personal. Inteligente, privado y rápido.</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 space-y-6 hover:shadow-2xl hover:shadow-indigo-100/30 transition-all duration-500 group">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition-transform">
                  <Bot className="w-7 h-7" />
                </div>
                <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">Privado</span>
              </div>
              <div className="space-y-3">
                <h4 className="text-xl font-bold text-gray-800 tracking-tight">Alertas inteligentes</h4>
                <p className="text-sm text-gray-500 leading-relaxed font-medium">
                  Bagi revisa tus gastos en tu dispositivo y te avisa de duplicados, gastos inusuales y pagos por vencer. No hay nada que configurar.
                </p>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 space-y-6 hover:shadow-2xl hover:shadow-indigo-100/30 transition-all duration-500 group">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition-transform">
                  <Mic className="w-7 h-7" />
                </div>
                <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">Opcional</span>
              </div>
              <div className="space-y-3">
                <h4 className="text-xl font-bold text-gray-800 tracking-tight">Voz y chat</h4>
                <p className="text-sm text-gray-500 leading-relaxed font-medium">
                  Registra gastos hablando o escribiendo: <i>"Gasté 45 mil en mercado con Visa"</i>. Solo necesitas una clave gratuita de <b>Gemini</b> u <b>OpenRouter</b>.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* SECTION 4: PRIVACY & SECURITY */}
      <section ref={privacyRef} className="min-h-screen w-full flex flex-col items-center justify-center p-6 py-20 bg-white shrink-0 relative">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent" />

        <div className="max-w-4xl w-full space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-sm font-black text-indigo-600">Tu privacidad es primero</h2>
            <h3 className="text-4xl font-black text-gray-900 tracking-tighter">Tú tienes el control absoluto de tu información.</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 space-y-6 hover:shadow-2xl hover:shadow-indigo-100/30 transition-all duration-500 group">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition-transform">
                <Smartphone className="w-7 h-7" />
              </div>
              <div className="space-y-3">
                <h4 className="text-xl font-bold text-gray-800 tracking-tight">En tu dispositivo</h4>
                <p className="text-sm text-gray-500 leading-relaxed font-medium">
                  Tus movimientos se guardan en tu dispositivo. Bagi <b>no guarda</b> tu información ni puede verla.
                </p>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 space-y-6 hover:shadow-2xl hover:shadow-indigo-100/30 transition-all duration-500 group">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm group-hover:scale-110 transition-transform">
                <Cloud className="w-7 h-7" />
              </div>
              <div className="space-y-3">
                <h4 className="text-xl font-bold text-gray-800 tracking-tight">Copia en tu Google Drive</h4>
                <p className="text-sm text-gray-500 leading-relaxed font-medium">
                  Bagi guarda una copia en tu <b>Google Drive</b> para que la uses desde cualquier dispositivo.
                </p>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 space-y-6 hover:shadow-2xl hover:shadow-indigo-100/30 transition-all duration-500 group">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition-transform">
                <Lock className="w-7 h-7" />
              </div>
              <div className="space-y-3">
                <h4 className="text-xl font-bold text-gray-800 tracking-tight">Tú decides</h4>
                <p className="text-sm text-gray-500 leading-relaxed font-medium">
                  La voz y el chat son opcionales. Si los usas, tu mensaje va directo a Gemini u OpenRouter, nunca a Bagi.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-8 flex flex-col items-center gap-6">
            <GoogleLoginButton onClick={() => handleLogin('google')} disabled={loading || demoLoading} />
            <button onClick={scrollToTop} className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2">
              Volver al inicio
            </button>

            <div className="flex items-center justify-center space-x-2 text-gray-400 text-[10px] font-black opacity-60">
              <span>Hecho con el</span>
              <Heart className="w-3 h-3 text-rose-500 fill-rose-500 animate-pulse" />
              <span>por devlusaja</span>
            </div>
          </div>
        </div>
      </section>
      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />
    </div>
  );
}
