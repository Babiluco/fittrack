/* ==========================================================================
   FitTrack — Configuração central
   ==========================================================================
   Responsabilidade: reunir num único lugar tudo que antes ficava espalhado
   e "hardcoded" pelo código (nome/versão do app, ambiente, flags de debug,
   endereço de API). Nenhum outro arquivo deve mais cravar esses valores
   direto no meio do código — sempre referenciar CONFIG.*.

   Hoje nada aqui conecta em lugar nenhum (API_URL é null, FEATURES estão
   todas desligadas). É só a base pronta pra quando isso passar a existir.
   ========================================================================== */
const CONFIG = {
  APP_NAME: 'FitTrack',
  VERSION: '1.0.0',
  ENV: 'production',        // 'development' | 'production'
  DEBUG: false,              // true liga os logs de [FitTrack] no console (ver utils.js -> log())

  API_URL: null,              // ainda não existe backend — fica null até existir
  STORAGE_KEY: 'fittrack_state_v1', // chave do localStorage (mantida como estava, mudar apagaria dados salvos de quem já usa o app)

  FEATURES: {
    CLOUD_SYNC: false,        // sync.js já está pronto, mas fica desligado até existir backend
    AUTH: false,               // auth.js já está pronto, mas fica desligado até existir backend
  },
};
