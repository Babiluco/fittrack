/* ==========================================================================
   FitTrack — Cliente Supabase
   ========================================================================== */

const SupabaseClient = (function(){
  let client = null;
  let sdkReadyPromise = null;

  function getConfig(){
    const cfg = CONFIG.SUPABASE || {};
    return {
      url: (cfg.URL || '').trim(),
      key: (cfg.PUBLISHABLE_KEY || '').trim(),
      passwordRedirectUrl: cfg.PASSWORD_REDIRECT_URL || (window.location.origin + window.location.pathname),
    };
  }

  function isConfigured(){
    const cfg = getConfig();
    return /^https:\/\/.+\.supabase\.co\/?$/.test(cfg.url) && cfg.key.length > 20;
  }

  function ensureReady(){
    if(window.supabase && typeof window.supabase.createClient === 'function'){
      return Promise.resolve(true);
    }
    if(sdkReadyPromise) return sdkReadyPromise;

    sdkReadyPromise = new Promise(resolve=>{
      const existing = document.querySelector('script[data-fittrack-supabase-sdk]');
      const script = existing || document.createElement('script');
      let settled = false;

      function finish(ok){
        if(settled) return;
        settled = true;
        resolve(ok);
      }

      script.dataset.fittrackSupabaseSdk = 'true';
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async = true;
      script.onload = ()=>finish(!!(window.supabase && typeof window.supabase.createClient === 'function'));
      script.onerror = ()=>finish(false);

      if(!existing) document.head.appendChild(script);
      setTimeout(()=>finish(!!(window.supabase && typeof window.supabase.createClient === 'function')), 8000);
    });

    return sdkReadyPromise;
  }

  function getClient(){
    if(client) return client;
    if(!isConfigured()) return null;
    if(!window.supabase || typeof window.supabase.createClient !== 'function'){
      console.error('Supabase SDK não foi carregado.');
      return null;
    }
    const cfg = getConfig();
    client = window.supabase.createClient(cfg.url, cfg.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return client;
  }

  return {getConfig, isConfigured, ensureReady, getClient};
})();
