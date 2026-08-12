/* ==========================================================================
   FitTrack — Funções utilitárias (puras, sem dependência de estado/tela)
   ==========================================================================
   Responsabilidade: funções pequenas e genéricas, usadas em vários pontos
   do app, que não sabem nada sobre `state`, telas ou localStorage — só
   recebem entrada e devolvem saída. Movidas pra cá de dentro do app.js e
   do storage.js pra organizar o projeto em módulos, sem mudar o que elas
   fazem.
   ========================================================================== */

function log(...args){
  if(typeof CONFIG!=='undefined' && CONFIG.DEBUG) console.log('[FitTrack]', ...args);
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function capitalize(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : s; }

function cryptoId(){
  return 'id_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36);
}

function todayKey(d){
  const date = d || new Date();
  return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
}

function fmtDate(key){
  const [y,m,d] = key.split('-');
  return `${d}/${m}/${y}`;
}

function startOfWeek(d){
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate()-day);
  date.setHours(0,0,0,0);
  return date;
}
