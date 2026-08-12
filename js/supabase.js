/* ==========================================================================
   FitTrack — Cliente Supabase
   ========================================================================== */

const SupabaseClient = (function(){
  let client = null;

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

  return {getConfig, isConfigured, getClient};
})();
