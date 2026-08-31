/* ==========================================================================
   FitTrack — Configuração central
   ==========================================================================
   Responsabilidade: reunir num único lugar tudo que antes ficava espalhado
   e "hardcoded" pelo código (nome/versão do app, ambiente, flags de debug,
   endereço de API). Nenhum outro arquivo deve mais cravar esses valores
   direto no meio do código — sempre referenciar CONFIG.*.

   O app já usa Supabase para autenticação, perfil e novos treinos concluídos.
   O LocalStorage continua sendo a base local imediata do app.
   ========================================================================== */
const CONFIG = {
  APP_NAME: 'FitTrack',
  VERSION: '1.0.0',
  ENV: 'production',        // 'development' | 'production'
  DEBUG: false,              // true liga os logs de [FitTrack] no console (ver utils.js -> log())

  API_URL: null,              // ainda não existe backend — fica null até existir
  STORAGE_KEY: 'fittrack_state_v1', // chave do localStorage (mantida como estava, mudar apagaria dados salvos de quem já usa o app)

  SUPABASE: {
    URL: 'https://usrcbdybqychocsdajhv.supabase.co',
    PUBLISHABLE_KEY: 'sb_publishable_1aTv01nUUDD5vw6gyuQfjQ_B8YoiJ08',
    PASSWORD_REDIRECT_URL: window.location.origin + window.location.pathname,
  },

  FEATURES: {
    CLOUD_SYNC: true,         // perfil e novos treinos usam Supabase; LocalStorage continua como base local
    AUTH: true,
  },
};
