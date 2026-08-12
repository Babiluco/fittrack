/* ==========================================================================
   FitTrack — Camada de sincronização (preparação para nuvem futura)
   ==========================================================================
   Responsabilidade: definir onde, no futuro, vai morar a lógica de mandar
   os dados do aparelho pra um servidor (e trazer de volta). Hoje o app é
   100% offline — tudo fica só no localStorage do navegador — então todo
   método aqui é um "no-op" (não faz nada de verdade), só devolve uma
   resposta simulada dizendo que não sincronizou.

   Quando existir backend, essas funções passam a chamar API.* de verdade;
   nada no resto do app precisa mudar, já que a "forma" da resposta é
   a mesma desde já.
   ========================================================================== */

const SYNC = {
  async syncProfile(){
    log('[Sync mock] syncProfile — app ainda é 100% offline');
    return {ok:true, synced:false, mock:true};
  },
  async syncWorkouts(){
    log('[Sync mock] syncWorkouts');
    return {ok:true, synced:false, mock:true};
  },
  async syncStatistics(){
    log('[Sync mock] syncStatistics');
    return {ok:true, synced:false, mock:true};
  },
  async syncMeasurements(){
    log('[Sync mock] syncMeasurements');
    return {ok:true, synced:false, mock:true};
  },
}; 
