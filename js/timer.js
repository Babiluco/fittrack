/* ==========================================================================
   FitTrack — Cronômetro de descanso
   ========================================================================== */

const RestTimer = (function(){
  let remaining = 0;
  let total = 0;
  let intervalId = null;
  let onTick = null;
  let onDone = null;

  // Um único AudioContext reaproveitado entre todos os beeps. Criar um
  // novo AudioContext a cada chamada (e nunca fechá-lo) acumula contextos
  // vivos na memória — no Chrome/Windows isso passa despercebido, mas no
  // Safari iOS e no Chrome Android o limite de contextos simultâneos é bem
  // mais apertado, e o WebView acaba travando depois de alguns descansos.
  let audioCtx = null;
  function getAudioCtx(){
    if(!audioCtx){
      const Ctx = window.AudioContext||window.webkitAudioContext;
      if(!Ctx) return null;
      audioCtx = new Ctx();
    }
    return audioCtx;
  }

  function beep(){
    try{
      const ctx = getAudioCtx();
      if(!ctx) return;
      // iOS suspende o contexto quando o app fica em segundo plano —
      // precisa "acordar" antes de tocar, senão o som (e, em alguns
      // casos, chamadas futuras) simplesmente não funciona.
      if(ctx.state==='suspended') ctx.resume();
      [0,0.18,0.36].forEach((t,i)=>{
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type='sine';
        osc.frequency.value = i===2?880:660;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime+t);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime+t+0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+t+0.16);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime+t);
        osc.stop(ctx.currentTime+t+0.18);
      });
    }catch(e){ /* audio not available */ }
  }

  function start(seconds, tickCb, doneCb){
    stop();
    remaining = seconds;
    total = seconds;
    onTick = tickCb;
    onDone = doneCb;
    if(onTick) onTick(remaining, total);
    intervalId = setInterval(()=>{
      remaining--;
      if(onTick) onTick(remaining, total);
      if(remaining<=0){
        stop();
        beep();
        if(onDone) onDone();
      }
    },1000);
  }

  function stop(){
    if(intervalId){ clearInterval(intervalId); intervalId=null; }
  }

  function pause(){ stop(); } // stop() já preserva remaining/total — pausar é só isso

  function resume(){
    if(intervalId || remaining<=0) return;
    intervalId = setInterval(()=>{
      remaining--;
      if(onTick) onTick(remaining, total);
      if(remaining<=0){
        stop();
        beep();
        if(onDone) onDone();
      }
    },1000);
  }

  function isRunning(){ return intervalId !== null; }
  function getRemaining(){ return remaining; }
  function getTotal(){ return total; }

  return {start, stop, pause, resume, isRunning, getRemaining, getTotal};
})();
