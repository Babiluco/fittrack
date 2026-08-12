/* ==========================================================================
   FitTrack — Camada de autenticação (arquitetura pronta, login ainda não)
   ==========================================================================
   Responsabilidade: definir o "contrato" (nomes de método, formato de
   retorno) que um sistema de login de verdade vai seguir no futuro — sem
   implementar login nenhum agora. O app hoje não tem conceito de conta:
   cada pessoa usa seu próprio navegador/celular, e os dados ficam só ali.

   isLogged() devolve `true` de propósito: como não existe sessão real
   ainda, o app trata "estar usando no aparelho" como equivalente a estar
   "logado" localmente. Isso muda quando existir backend de verdade.
   ========================================================================== */

const AUTH = {
  async login(email, password){
    log('[Auth mock] login()', email);
    return {ok:true, user:{id:'local-user', name: state.user.name, email: email||null}, mock:true};
  },
  async register(email, password, name){
    log('[Auth mock] register()', email);
    return {ok:true, user:{id:'local-user', name: name||state.user.name, email: email||null}, mock:true};
  },
  async logout(){
    log('[Auth mock] logout()');
    return {ok:true, mock:true};
  },
  isLogged(){
    return true; // sem conceito de sessão real ainda — ver comentário acima
  },
  async refreshSession(){
    log('[Auth mock] refreshSession()');
    return {ok:true, mock:true};
  },
}; 
