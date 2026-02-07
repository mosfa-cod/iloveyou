
import React, { useState, useEffect, useRef } from 'react';
import { WordResult, SavedWord } from './types';
import { translateAndExplain, generateIllustration, generateSpeech, decodeAudioData, getMotivationalQuote } from './services/geminiService';

const DECORATIONS = ['📖', '✏️', '🌟', '🎨', '🧠', '🌍', '✨', '🍎', '🧸', '🚀', '⭐', '🎈', '🎓', '📝'];

const CATEGORIES = [
  { id: 'school', name: 'المدرسة', icon: '🏫', color: 'bg-blue-400', suggestions: ['Teacher', 'Classroom', 'Library', 'Homework', 'Success'] },
  { id: 'tech', name: 'التكنولوجيا', icon: '💻', color: 'bg-purple-400', suggestions: ['Robot', 'Computer', 'Internet', 'Future', 'Space'] },
  { id: 'travel', name: 'السفر', icon: '✈️', color: 'bg-orange-400', suggestions: ['Airplane', 'Passport', 'Adventure', 'Beach', 'Mountain'] },
  { id: 'emotions', name: 'المشاعر', icon: '😊', color: 'bg-pink-400', suggestions: ['Happy', 'Brave', 'Kind', 'Smart', 'Grateful'] },
];

const BACKUP_WISDOM = [
  "العلم يرفع بيوتاً لا عماد لها، والجهل يهدم بيت العز والكرم.",
  "يا بني، اجعل من العلم زاداً لك، ومن الأخلاق ثوباً ترتديه.",
  "من طلب العلا سهر الليالي، ومن زرع الجد حصد النجاح.",
  "الأدب قبل العلم، فكن مؤدباً لترتقي بعلمك.",
  "أحفادي الأبطال، أنتم أمل المستقبل وبكم يزدهر الوطن."
];

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<WordResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [favorites, setFavorites] = useState<SavedWord[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [wisdom, setWisdom] = useState<string>(BACKUP_WISDOM[0]);
  const [errorType, setErrorType] = useState<'NONE' | 'QUOTA' | 'GENERIC'>('NONE');
  const [hasApiKey, setHasApiKey] = useState(false);

  // تحميل البيانات عند بداية التشغيل من الذاكرة الدائمة
  useEffect(() => {
    const checkKey = async () => {
      if ((window as any).aistudio?.hasSelectedApiKey) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    };
    checkKey();

    // استعادة الكلمات المحفوظة من الذاكرة المحلية (LocalStorage)
    const savedFavs = localStorage.getItem('mustafa_dictionary_favs');
    if (savedFavs) {
      try {
        setFavorites(JSON.parse(savedFavs));
      } catch (e) {
        console.error("خطأ في تحميل الكلمات المحفوظة", e);
      }
    }

    const savedTheme = localStorage.getItem('mustafa_theme');
    if (savedTheme) setIsDarkMode(savedTheme === 'dark');

    setWisdom(BACKUP_WISDOM[Math.floor(Math.random() * BACKUP_WISDOM.length)]);
    fetchWisdom();
  }, []);

  // دالة لتحديث الذاكرة الدائمة عند كل تغيير
  const updateAndPersistFavorites = (newList: SavedWord[]) => {
    setFavorites(newList);
    localStorage.setItem('mustafa_dictionary_favs', JSON.stringify(newList));
  };

  const fetchWisdom = async () => {
    try {
      const q = await getMotivationalQuote();
      if (q) setWisdom(q);
    } catch {
      setWisdom(BACKUP_WISDOM[Math.floor(Math.random() * BACKUP_WISDOM.length)]);
    }
  };

  const handleSelectKey = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      setHasApiKey(true);
      window.location.reload();
    }
  };

  const resetSearch = () => {
    setResult(null);
    setQuery('');
    setErrorType('NONE');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    setImageLoading(false);
    setResult(null);
    setErrorType('NONE');
    setQuery(text);
    
    try {
      const data = await translateAndExplain(text);
      setResult(data);
      setLoading(false); 
      
      try {
        setImageLoading(true);
        const img = await generateIllustration(data.translation);
        if (img) setResult(prev => prev ? { ...prev, imageUrl: img } : null);
      } catch { /* فشل الصورة لا يعطل التطبيق */ }
      finally { setImageLoading(false); }
    } catch (err: any) {
      if (err.message === "QUOTA_EXCEEDED") setErrorType('QUOTA');
      else setErrorType('GENERIC');
      setLoading(false);
    }
  };

  const toggleFavorite = () => {
    if (!result) return;
    const exists = favorites.find(f => f.original.toLowerCase() === result.original.toLowerCase());
    let newFavs: SavedWord[];
    if (exists) {
      newFavs = favorites.filter(f => f.original.toLowerCase() !== result.original.toLowerCase());
    } else {
      newFavs = [...favorites, { ...result, id: Date.now().toString(), timestamp: Date.now() }];
    }
    updateAndPersistFavorites(newFavs);
  };

  const removeFromFavorites = (id: string) => {
    const newFavs = favorites.filter(f => f.id !== id);
    updateAndPersistFavorites(newFavs);
  };

  const playAudio = async (text: string, lang: 'ar' | 'en') => {
    if (audioLoading) return;
    setAudioLoading(true);
    try {
      const audioBytes = await generateSpeech(text, lang === 'ar');
      if (audioBytes) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const buffer = await decodeAudioData(audioBytes, audioCtx);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start();
      }
    } catch (err) { console.error("خطأ في الصوت", err); }
    finally { setAudioLoading(false); }
  };

  const themeClasses = isDarkMode ? "bg-slate-900 text-white" : "bg-[#F0F9FF] text-slate-900";

  return (
    <div className={`relative min-h-screen transition-colors duration-500 font-['Tajawal'] ${themeClasses}`}>
      {DECORATIONS.map((emoji, i) => (
        <div key={i} className="decoration opacity-10 text-4xl select-none" style={{ left: `${Math.random() * 100}vw`, animationDelay: `${Math.random() * 10}s` }}>{emoji}</div>
      ))}

      <header className={`sticky top-0 z-40 backdrop-blur-md border-b-4 transition-colors ${isDarkMode ? 'bg-slate-900/80 border-slate-700' : 'bg-white/80 border-blue-100'}`}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-3xl flex items-center justify-center text-2xl md:text-4xl shadow-xl animate-pulse">🎓</div>
            <div>
              <h1 className="text-xl md:text-3xl font-black text-gradient">قاموس دحروج الذكي</h1>
              {!hasApiKey && (
                <button onClick={handleSelectKey} className="text-[10px] md:text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full border border-amber-200 font-black flex items-center gap-1 hover:bg-amber-200 transition-all">
                  ضع المفتاح هنا 🔑
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setIsDarkMode(!isDarkMode); localStorage.setItem('mustafa_theme', !isDarkMode ? 'dark' : 'light'); }} className="p-3 rounded-2xl bg-white/50 text-2xl shadow-sm transition-transform active:scale-90">{isDarkMode ? '🌞' : '🌚'}</button>
            <button onClick={() => setIsSidebarOpen(true)} className="bg-red-500 text-white px-5 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg hover:scale-105 transition-transform active:scale-95 border-b-4 border-red-700">
              ❤️ <span className="hidden md:inline">كنوزي</span>
              <span className="bg-white text-red-500 text-xs px-2 py-0.5 rounded-full font-bold">{favorites.length}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 relative z-10">
        {!result && !loading && (
          <div className="mb-12 text-center">
            <div className={`inline-flex flex-col items-center p-8 rounded-[3.5rem] border-4 border-dashed animate-in fade-in slide-in-from-top-4 duration-1000 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-blue-200 shadow-2xl'}`}>
              <div className="flex items-center gap-2 mb-3 text-yellow-500 font-black text-sm md:text-lg">
                  <span>🌟</span> نصيحة الأستاذ مصطفى <span>🌟</span>
              </div>
              <p className="text-2xl md:text-4xl font-black italic max-w-3xl leading-relaxed text-blue-600">"{wisdom}"</p>
            </div>
          </div>
        )}

        {!result && !loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mb-16 animate-in zoom-in duration-500">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleSearch(cat.suggestions[Math.floor(Math.random() * cat.suggestions.length)])}
                className={`${cat.color} p-8 md:p-10 rounded-[3rem] text-white transition-all transform hover:scale-110 hover:rotate-2 active:scale-90 shadow-2xl flex flex-col items-center gap-4 group border-b-8 border-black/10`}
              >
                <span className="text-5xl md:text-7xl group-hover:animate-bounce">{cat.icon}</span>
                <span className="font-black text-xl md:text-2xl">{cat.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className={`max-w-4xl mx-auto ${result || loading ? 'mb-10' : 'mb-20'}`}>
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(query); }} className="relative group">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="اكتب كلمة جديدة لتتعلمها يا بطل..."
              className={`w-full py-8 md:py-12 px-12 md:px-20 rounded-full text-2xl md:text-5xl font-bold outline-none border-8 transition-all shadow-3xl ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-white border-blue-100 text-slate-900 focus:border-blue-400'}`}
            />
            <button type="submit" className="absolute left-4 top-4 bottom-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-12 md:px-20 rounded-full font-black text-xl md:text-3xl shadow-xl transition-all hover:brightness-110 active:scale-95 flex items-center gap-3">
              اكتشف <span className="animate-bounce">🚀</span>
            </button>
          </form>
          
          {(result || errorType !== 'NONE') && (
            <div className="mt-8 flex justify-center animate-in slide-in-from-bottom-4">
              <button 
                onClick={resetSearch}
                className="bg-white text-blue-600 border-4 border-blue-200 px-12 py-5 rounded-full font-black text-2xl shadow-2xl hover:bg-blue-50 transition-all flex items-center gap-4 active:scale-95 group"
              >
                <span className="group-hover:rotate-180 transition-transform duration-500">🆕</span> ابحث عن كلمة جديدة
              </button>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex flex-col items-center py-24 animate-pulse text-center">
            <div className="text-[10rem] mb-8 animate-bounce">📚</div>
            <p className="text-3xl md:text-5xl font-black text-blue-600">جاري البحث في كنز المعلومات...</p>
          </div>
        )}

        {errorType === 'QUOTA' && (
          <div className="max-w-3xl mx-auto p-16 bg-amber-50 border-8 border-amber-300 rounded-[5rem] text-center shadow-3xl animate-in zoom-in">
            <div className="text-[10rem] mb-10">⏳</div>
            <h3 className="text-4xl md:text-6xl font-black text-amber-800 mb-8">الجد مصطفى يرتاح قليلاً!</h3>
            <p className="text-2xl font-bold text-amber-700 mb-12 leading-relaxed">
              لقد سألتم الكثير من الأسئلة الرائعة اليوم! انتظر دقيقة واحدة، أو استعمل "المفتاح الخاص" من الأعلى لتستمر في رحلة العلم بلا توقف.
            </p>
            <button onClick={() => handleSearch(query)} className="bg-amber-500 text-white px-16 py-8 rounded-full font-black text-3xl hover:bg-amber-600 transition-all shadow-2xl active:scale-95 border-b-8 border-amber-700">جرب مجدداً 🔄</button>
          </div>
        )}

        {result && !loading && errorType === 'NONE' && (
          <div className={`rounded-[5rem] p-12 md:p-20 overflow-hidden relative border-[12px] animate-in zoom-in duration-700 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-white shadow-4xl'}`}>
            <div className="absolute top-10 right-10 flex flex-col gap-6 z-20">
              <button 
                onClick={toggleFavorite} 
                className={`w-20 h-20 md:w-24 md:h-24 rounded-[2.5rem] flex items-center justify-center text-5xl transition-all shadow-2xl hover:scale-125 active:scale-90 ${favorites.find(f => f.original.toLowerCase() === result.original.toLowerCase()) ? 'bg-red-500 text-white border-b-8 border-red-700 shadow-red-200' : 'bg-white/90 text-red-500 border-4 border-red-50'}`}
                title="حفظ للأبد في الحقيبة"
              >
                {favorites.find(f => f.original.toLowerCase() === result.original.toLowerCase()) ? '❤️' : '🤍'}
              </button>
            </div>

            <div className="grid lg:grid-cols-2 gap-20 items-center">
              <div className="space-y-12 order-2 lg:order-1">
                <div className="text-center lg:text-right">
                  <span className="inline-block px-8 py-3 rounded-3xl bg-blue-100 text-blue-600 font-black text-lg uppercase mb-8 shadow-inner border-2 border-blue-200">{result.partOfSpeech}</span>
                  <h2 className="text-7xl md:text-[10rem] font-black mb-4 leading-none tracking-tighter text-slate-900 dark:text-white">{result.original}</h2>
                  <p className="text-5xl md:text-7xl font-black text-blue-600 drop-shadow-sm">{result.translation}</p>
                </div>

                <div className={`p-10 md:p-14 rounded-[4rem] border-4 ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-blue-50/50 border-blue-100 shadow-inner'}`}>
                   <p className="text-3xl md:text-4xl font-bold leading-snug mb-12 text-slate-700 dark:text-slate-200">"{result.definition}"</p>
                   <div className="space-y-10">
                      <div className="flex items-start gap-8 group">
                        <button onClick={() => playAudio(result.exampleAr, 'ar')} className="mt-1 w-20 h-20 rounded-3xl bg-white text-5xl flex items-center justify-center shadow-2xl group-active:scale-90 transition-all border-4 border-blue-50 flex-shrink-0">🔊</button>
                        <p className="text-3xl md:text-4xl font-black text-blue-800 dark:text-blue-300 leading-tight">{result.exampleAr}</p>
                      </div>
                      <div className="flex items-start gap-8 group">
                        <button onClick={() => playAudio(result.exampleEn, 'en')} className="mt-1 w-20 h-20 rounded-3xl bg-white text-5xl flex items-center justify-center shadow-2xl group-active:scale-90 transition-all border-4 border-blue-50 flex-shrink-0">🔊</button>
                        <p className="text-3xl md:text-4xl font-bold opacity-60 italic leading-tight">"{result.exampleEn}"</p>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <button onClick={() => playAudio(result.original, 'en')} className="bg-slate-900 text-white py-10 rounded-[3rem] font-black text-2xl md:text-3xl shadow-2xl active:scale-95 flex flex-col items-center gap-4 hover:brightness-125 transition-all">
                    <span className="text-6xl">🇺🇸</span> نطق الكلمة
                  </button>
                  <button onClick={() => playAudio(result.translation, 'ar')} className="bg-yellow-400 text-slate-900 py-10 rounded-[3rem] font-black text-2xl md:text-3xl shadow-2xl active:scale-95 flex flex-col items-center gap-4 hover:brightness-110 transition-all">
                    <span className="text-6xl">🇪🇬</span> نطق المعنى
                  </button>
                </div>
              </div>

              <div className="order-1 lg:order-2">
                <div className={`aspect-square rounded-[5rem] overflow-hidden border-[16px] border-white dark:border-slate-700 shadow-4xl relative transition-all duration-1000 ${imageLoading ? 'animate-pulse scale-95 opacity-50' : 'scale-100'}`}>
                   {result.imageUrl ? (
                     <img src={result.imageUrl} alt={result.translation} className="w-full h-full object-cover" />
                   ) : (
                     <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-100 p-16 text-center">
                        <span className="text-[12rem] mb-10 animate-bounce">🎨</span>
                        <p className="text-4xl font-black text-blue-600">{imageLoading ? 'الجد مصطفى يرسم لكم...' : 'لوحة الكلمة'}</p>
                     </div>
                   )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Sidebar - Saved Items */}
      <div className={`fixed inset-0 z-50 transition-all duration-500 ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={() => setIsSidebarOpen(false)}></div>
        <aside className={`absolute left-0 top-0 bottom-0 w-full max-w-md transition-transform duration-500 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isDarkMode ? 'bg-slate-800' : 'bg-white shadow-4xl'}`}>
          <div className="p-10 h-full flex flex-col">
            <div className="flex justify-between items-center mb-12">
              <div>
                <h2 className="text-4xl font-black text-gradient">حقيبة كنوزي 💎</h2>
                <p className="text-sm font-bold opacity-50">محفوظة للأبد في جهازك</p>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="text-5xl hover:rotate-90 transition-transform p-2">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-6 pr-4 custom-scrollbar">
               {favorites.length === 0 ? (
                 <div className="text-center py-32 opacity-30">
                   <div className="text-[10rem] mb-10">🎒</div>
                   <p className="text-2xl font-bold leading-relaxed">حقيبتك فارغة تماماً!<br/>ابدأ بجمع الكلمات لتجدها هنا دائماً حتى بعد غلق الجهاز.</p>
                 </div>
               ) : (
                 favorites.map(word => (
                   <div 
                    key={word.id} 
                    className={`p-8 rounded-[3rem] border-4 transition-all hover:scale-105 group relative ${isDarkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-blue-50 border-blue-100 shadow-xl'}`}
                   >
                     <div className="flex justify-between items-start mb-6">
                       <div onClick={() => { setResult(word); setIsSidebarOpen(false); }} className="cursor-pointer flex-1">
                         <p className="font-black text-3xl text-slate-900 dark:text-white">{word.original}</p>
                         <p className="text-xl font-bold text-blue-600">{word.translation}</p>
                       </div>
                       <button 
                        onClick={(e) => { e.stopPropagation(); removeFromFavorites(word.id); }}
                        className="text-red-400 hover:text-red-600 text-3xl p-2 transition-transform active:scale-75"
                        title="حذف نهائي"
                       >🗑️</button>
                     </div>
                     
                     <div className="flex gap-4">
                        <button 
                          onClick={(e) => { e.stopPropagation(); playAudio(word.original, 'en'); }} 
                          className="flex-1 bg-white dark:bg-slate-800 py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg border-2 border-slate-100 dark:border-slate-600 active:scale-95 hover:bg-slate-50 transition-colors"
                        >
                          <span className="text-2xl">🇺🇸</span>
                          <span className="font-black text-sm">EN</span>
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); playAudio(word.translation, 'ar'); }} 
                          className="flex-1 bg-white dark:bg-slate-800 py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg border-2 border-slate-100 dark:border-slate-600 active:scale-95 hover:bg-slate-50 transition-colors"
                        >
                          <span className="text-2xl">🇪🇬</span>
                          <span className="font-black text-sm">عربي</span>
                        </button>
                     </div>
                   </div>
                 ))
               )}
            </div>
            <div className="mt-8 pt-6 border-t-2 border-dashed border-slate-200 dark:border-slate-700 text-center text-xs font-bold opacity-40">
               جميع الكلمات محفوظة في ذاكرة هذا الجهاز 🔒
            </div>
          </div>
        </aside>
      </div>

      <footer className="text-center py-20 opacity-30 font-black">
         <p className="text-2xl">صنع بكل الحب لأحفاد الأستاذ مصطفى عبد العال دحروج ❤️ 2025</p>
         <p className="text-sm mt-2">تخزين دائم ومؤمن للأبد</p>
      </footer>
    </div>
  );
};

export default App;
