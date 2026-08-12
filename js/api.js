/* ==========================================================================
   FitTrack — Camada de API (preparação para um backend futuro)
   ==========================================================================
   Responsabilidade: dar ao resto do app um jeito único e já-no-formato-certo
   de falar com um servidor — mesmo não existindo nenhum servidor ainda.

   Hoje NENHUM método aqui conecta em lugar nenhum. Todos devolvem uma
   resposta simulada (mock), sempre de forma assíncrona (Promise), porque é
   assim que uma chamada de rede real vai se comportar quando isso passar a
   existir — então o código que for escrito contra API.get()/post() etc.
   já vai funcionar sem precisar ser reescrito depois, só trocando o miolo
   deste arquivo.
   ========================================================================== */

const API = {
  async get(endpoint){
    log(`[API mock] GET ${endpoint}`);
    return {ok:true, data:null, mock:true};
  },
  async post(endpoint, body){
    log(`[API mock] POST ${endpoint}`, body);
    return {ok:true, data:body||null, mock:true};
  },
  async put(endpoint, body){
    log(`[API mock] PUT ${endpoint}`, body);
    return {ok:true, data:body||null, mock:true};
  },
  async delete(endpoint){
    log(`[API mock] DELETE ${endpoint}`);
    return {ok:true, data:null, mock:true};
  },
};
