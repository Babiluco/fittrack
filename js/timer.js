/* ==========================================================================
   FitTrack — Cronômetro de descanso
   ========================================================================== */

const RestTimer = (function(){
  let remaining = 0;
  let total = 0;
  let intervalId = null;
  let onTick = null;
  let onDone = null;

  function beep(){
    try{
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
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

  function isRunning(){ return intervalId !== null; }
  function getRemaining(){ return remaining; }
  function getTotal(){ return total; }

  return {start, stop, isRunning, getRemaining, getTotal};
})();

