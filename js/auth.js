/* ==========================================================================
   FitTrack — Autenticação Supabase
   ========================================================================== */

const AUTH = (function(){
  let currentSession = null;
  let authListener = null;

  function client(){
    const supabase = SupabaseClient.getClient();
    if(!supabase){
      return null;
    }
    return supabase;
  }

  function notConfiguredResult(){
    return {
      ok:false,
      code:'not_configured',
      message:'Configure o Supabase para usar contas no FitTrack.',
    };
  }

  function friendlyError(error, fallback){
    const msg = String(error?.message || '').toLowerCase();
    if(msg.includes('invalid login') || msg.includes('invalid credentials')) return 'Email ou senha incorretos.';
    if(msg.includes('email')) return 'Informe um email válido.';
    if(msg.includes('password') || msg.includes('senha')) return 'A senha não atende aos requisitos mínimos.';
    if(msg.includes('rate limit')) return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
    return fallback || 'Não foi possível concluir. Tente novamente.';
  }

  function isValidEmail(email){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email||'').trim());
  }

  function validatePassword(password){
    if(String(password||'').length < 6){
      return 'Use uma senha com pelo menos 6 caracteres.';
    }
    return null;
  }

  async function signUp({name, email, password}){
    const supabase = client();
    if(!supabase) return notConfiguredResult();
    try{
      const {data, error} = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {name},
          emailRedirectTo: SupabaseClient.getConfig().passwordRedirectUrl,
        },
      });
      if(error) throw error;
      currentSession = data.session || currentSession;
      return {
        ok:true,
        user:data.user || null,
        session:data.session || null,
        needsEmailConfirmation: !!data.user && !data.session,
      };
    }catch(error){
      console.error('[FitTrack Auth] signUp', error);
      return {ok:false, message:friendlyError(error, 'Não foi possível criar a conta. Tente novamente.')};
    }
  }

  async function signIn({email, password}){
    const supabase = client();
    if(!supabase) return notConfiguredResult();
    try{
      const {data, error} = await supabase.auth.signInWithPassword({email, password});
      if(error) throw error;
      currentSession = data.session || null;
      return {ok:true, user:data.user || null, session:currentSession};
    }catch(error){
      console.error('[FitTrack Auth] signIn', error);
      return {ok:false, message:friendlyError(error, 'Não foi possível entrar. Tente novamente.')};
    }
  }

  async function signOut(){
    const supabase = client();
    if(!supabase) return notConfiguredResult();
    try{
      const {error} = await supabase.auth.signOut();
      if(error) throw error;
      currentSession = null;
      return {ok:true};
    }catch(error){
      console.error('[FitTrack Auth] signOut', error);
      return {ok:false, message:'Não foi possível sair. Tente novamente.'};
    }
  }

  async function getSession(){
    const supabase = client();
    if(!supabase) return null;
    try{
      const {data, error} = await supabase.auth.getSession();
      if(error) throw error;
      currentSession = data.session || null;
      return currentSession;
    }catch(error){
      console.error('[FitTrack Auth] getSession', error);
      return null;
    }
  }

  async function getCurrentUser(){
    const session = currentSession || await getSession();
    return session?.user || null;
  }

  async function isAuthenticated(){
    return !!(await getSession());
  }

  async function resetPassword(email){
    const supabase = client();
    if(!supabase) return notConfiguredResult();
    try{
      const {error} = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: SupabaseClient.getConfig().passwordRedirectUrl,
      });
      if(error) throw error;
      return {ok:true};
    }catch(error){
      console.error('[FitTrack Auth] resetPassword', error);
      return {ok:false, message:friendlyError(error, 'Não foi possível enviar o email de recuperação.')};
    }
  }

  async function updatePassword(password){
    const supabase = client();
    if(!supabase) return notConfiguredResult();
    try{
      const {data, error} = await supabase.auth.updateUser({password});
      if(error) throw error;
      return {ok:true, user:data.user || null};
    }catch(error){
      console.error('[FitTrack Auth] updatePassword', error);
      return {ok:false, message:friendlyError(error, 'Não foi possível atualizar a senha.')};
    }
  }

  function onAuthStateChange(callback){
    const supabase = client();
    if(!supabase) return {unsubscribe(){}};
    if(authListener) authListener.unsubscribe();
    const {data} = supabase.auth.onAuthStateChange((event, session)=>{
      currentSession = session || null;
      callback(event, session || null);
    });
    authListener = data.subscription;
    return authListener;
  }


  return {
    signUp,
    signIn,
    signOut,
    getSession,
    getCurrentUser,
    isAuthenticated,
    resetPassword,
    updatePassword,
    onAuthStateChange,
    isValidEmail,
    validatePassword,
  };
})();

