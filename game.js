(() => {
  // Fallback chart used when no JSON file is loaded. Times are milliseconds from song start.
  const chartDefault = {
    song: "Game Over Baby", bpm: 120, offsetMs: 0, approximate: true,
    notes: [
      {timeMs:1000,lane:0},{timeMs:1500,lane:2},{timeMs:2000,lane:1},{timeMs:2500,lane:3},
      {timeMs:3000,lane:0},{timeMs:3250,lane:2},{timeMs:3500,lane:1},{timeMs:4000,lane:3},
      {timeMs:4500,lane:2},{timeMs:5000,lane:0},{timeMs:5500,lane:1},{timeMs:5750,lane:3},
      {timeMs:6000,lane:2},{timeMs:6500,lane:0},{timeMs:7000,lane:3},{timeMs:7500,lane:1},
      {timeMs:8000,lane:0},{timeMs:8250,lane:1},{timeMs:8500,lane:2},{timeMs:9000,lane:3},
      {timeMs:9500,lane:1},{timeMs:10000,lane:2},{timeMs:10500,lane:0},{timeMs:11000,lane:3},
      {timeMs:11500,lane:2},{timeMs:11750,lane:0},{timeMs:12000,lane:1},{timeMs:12500,lane:3},
      {timeMs:13000,lane:0},{timeMs:13500,lane:2},{timeMs:14000,lane:1},{timeMs:14500,lane:3},
      {timeMs:15000,lane:2},{timeMs:15500,lane:1},{timeMs:15750,lane:3},{timeMs:16000,lane:0}
    ]
  };
  // Keyboard mapping and lane labels; the player can change these in the settings panel.
  const defaultLaneKeys = ['ArrowLeft','ArrowDown','ArrowUp','ArrowRight'];
  const laneNames = ['Izquierda','Abajo','Arriba','Derecha'];
  let laneKeys = [...defaultLaneKeys], bindingLane = null;
  // Lane arrows and their accent colors, indexed by lane number 0 through 3.
  const arrows = ['←','↓','↑','→'];
  const colors = ['#50e7f2','#ff4db8','#a989ff','#ffd65a'];
  // Cache the page elements that the game updates repeatedly.
  const stage = document.querySelector('#stage'), notesBox = document.querySelector('#notes');
  const scoreEl = document.querySelector('#score'), comboEl = document.querySelector('#combo');
  const clockEl = document.querySelector('#clock'), feedback = document.querySelector('#feedback');
  const message = document.querySelector('#stageMessage');
  // Current chart, playback state, score, audio object, and note travel speed.
  let chart = chartDefault, notes = [], running = false, startedAt = 0, pausedAt = 0, preRoll = false, preRollStartedAt = 0;
  let score = 0, combo = 0, audio = null, audioUrl = null, lastTime = 0;
  let leadMs = 1800;
  const hitWindowMs = 150;

  // Rebuild every note element; used at startup, reset, and when a chart is loaded.
  function resetNotes() {
    notesBox.replaceChildren();
    notes = chart.notes.map((n, i) => {
      const el = document.createElement('div');
      el.className = 'note'; el.textContent = arrows[n.lane];
      el.style.setProperty('--note-color', colors[n.lane]);
      el.style.left = `${(n.lane + .5) * 25}%`;
      notesBox.appendChild(el);
      return {timeMs:Number(n.timeMs), lane:Number(n.lane), el, hit:false, missed:false, id:i};
    }).sort((a,b)=>a.timeMs-b.timeMs);
  }
  // Convert keyboard event names into short labels for the assignment buttons.
  function keyLabel(key) {
    const labels = {ArrowLeft:'←',ArrowDown:'↓',ArrowUp:'↑',ArrowRight:'→', ' ':'Espacio'};
    return labels[key] || (key.length === 1 ? key.toUpperCase() : key);
  }
  function refreshKeyButtons() {
    document.querySelectorAll('.key-bind').forEach(button => {
      const lane = Number(button.dataset.bindLane);
      button.textContent = keyLabel(laneKeys[lane]);
      button.classList.toggle('waiting', bindingLane === lane);
    });
  }
  // Return the timeline position, including the visual lead-in before the audio starts.
  function chartTime() {
    if (!running) return pausedAt;
    if (preRoll) return performance.now() - preRollStartedAt - leadMs;
    return audio ? audio.currentTime * 1000 : performance.now() - startedAt;
  }
  // Show short gameplay messages such as hit quality, misses, or key assignment.
  function setFeedback(text, color='var(--cyan)') { feedback.textContent=text; feedback.style.color=color; }
  function updateScore() { scoreEl.textContent=String(score).padStart(6,'0'); comboEl.innerHTML=`${combo}<span class="small">×</span>`; }
  function formatTime(ms) { const s=Math.max(0,Math.floor(ms/1000)); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }

  // Animation loop: runs the lead-in, keeps time with audio, and moves notes downward.
  function frame(now) {
    requestAnimationFrame(frame);
    if (!running) return;
    if(preRoll && now-preRollStartedAt>=leadMs){
      preRoll=false;
      if(audio){audio.currentTime=0;audio.play().catch(()=>setFeedback('No se pudo reproducir el MP3','#ff687e'));}
      startedAt=performance.now();setFeedback('A jugar');
    }
    const t=chartTime();
    if (audio && !preRoll && audio.ended) { running=false; pausedAt=t; setFeedback('FIN · REINICIA PARA JUGAR'); message.hidden=false; message.innerHTML='¡BUEN JUEGO!<br><small>REINICIA PARA VOLVER A EMPEZAR</small>'; return; }
    clockEl.textContent=preRoll ? 'EN ' + Math.ceil((leadMs-(now-preRollStartedAt))/1000) : formatTime(t);
    // Start each note above the playfield and move it to the strike line at its target time.
    const h=stage.clientHeight, strikeY=h-76, travel=strikeY+48;
    for (const n of notes) {
      if(n.hit||n.missed){n.el.hidden=true;continue;}
      const until=n.timeMs-chart.offsetMs-t;
      if(until < -hitWindowMs){n.missed=true;n.el.remove();combo=0;updateScore();setFeedback('FALLO','#ff687e');continue;}
      n.el.hidden=until>leadMs;
      if(!n.el.hidden){const y=strikeY-(until/leadMs)*travel;n.el.style.top=`${y}px`;}
    }
    lastTime=t;
  }
  requestAnimationFrame(frame);

  // Begin a fresh round and give the first notes a lead-in before music playback.
  function start() {
    if (running) return;
    if(audio){audio.pause();audio.currentTime=0;}
    preRoll=true;preRollStartedAt=performance.now();startedAt=preRollStartedAt;pausedAt=-leadMs;running=true;score=0;combo=0;updateScore();
    resetNotes();
    message.hidden=true;setFeedback('¡VAMOS!');
  }
  // Stop audio and restore score, clock, notes, and the ready prompt.
  function reset() {
    running=false;preRoll=false; if(audio){audio.pause();audio.currentTime=0;} pausedAt=0; score=0;combo=0;updateScore();clockEl.textContent='00:00';
    resetNotes();
    message.hidden=false;message.innerHTML='PULSA EMPEZAR<br><small>Y PREPÁRATE</small>';setFeedback('LISTO');
  }
  // Compare a key press with the nearest unplayed note in that lane and score it.
  function pressLane(lane) {
    if(!running)return;
    const t=chartTime()+chart.offsetMs;
    const candidate=notes.filter(n=>n.lane===lane&&!n.hit&&!n.missed).sort((a,b)=>Math.abs(a.timeMs-t)-Math.abs(b.timeMs-t))[0];
    const receptor=document.querySelector(`.receptor[data-lane="${lane}"]`);receptor.classList.add('active');setTimeout(()=>receptor.classList.remove('active'),100);
    if(candidate&&Math.abs(candidate.timeMs-t)<=hitWindowMs){candidate.hit=true;candidate.el.remove();combo++;score+=combo%10===0?150:100;updateScore();setFeedback(Math.abs(candidate.timeMs-t)<55?'PERFECTO':'BIEN',Math.abs(candidate.timeMs-t)<55?'#ffd65a':'var(--cyan)');}
    else {combo=0;updateScore();setFeedback('FALLO','#ff687e');}
  }
  // Capture key binding when requested; otherwise route the key to its lane.
  document.addEventListener('keydown',e=>{
    if(bindingLane!==null){
      e.preventDefault();
      if(e.key==='Escape'){bindingLane=null;refreshKeyButtons();setFeedback('ASIGNACION CANCELADA');return;}
      const newKey=e.key.length===1?e.key.toLowerCase():e.key;
      const alreadyUsed=laneKeys.findIndex((key,index)=>key===newKey&&index!==bindingLane);
      if(alreadyUsed!==-1){setFeedback('ESA TECLA YA ESTA ASIGNADA','#ff687e');return;}
      laneKeys[bindingLane]=newKey;bindingLane=null;refreshKeyButtons();setFeedback(`TECLA ASIGNADA: ${keyLabel(newKey)}`);return;
    }
    const lane=laneKeys.indexOf(e.key.length===1?e.key.toLowerCase():e.key);
    if(lane!==-1){e.preventDefault();pressLane(lane);}
  });
  // Clicking a lane button waits for the next key press; the reset button restores arrows.
  document.querySelectorAll('.key-bind').forEach(button=>button.addEventListener('click',()=>{
    bindingLane=Number(button.dataset.bindLane);refreshKeyButtons();setFeedback(`PULSA UNA TECLA PARA ${laneNames[bindingLane].toUpperCase()}`,'#ffd65a');
  }));
  document.querySelector('#defaultKeys').addEventListener('click',()=>{
    laneKeys=[...defaultLaneKeys];bindingLane=null;refreshKeyButtons();setFeedback('FLECHAS RESTAURADAS');
  });
  document.querySelector('#difficulty').addEventListener('change',e=>{ leadMs=Number(e.target.value); });
  document.querySelector('#startButton').addEventListener('click',start);
  document.querySelector('#resetButton').addEventListener('click',reset);
  // Load a user-selected audio file locally; its playback clock drives the chart.
  document.querySelector('#audioFile').addEventListener('change',e=>{
    const file=e.target.files[0];if(!file)return;
    if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl=URL.createObjectURL(file);
    if(audio)audio.pause();audio=new Audio(audioUrl);document.querySelector('#audioName').textContent=file.name;reset();
  });
  // Read and validate a user-selected JSON chart before replacing the current chart.
  document.querySelector('#chartFile').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    try {
      const parsed = JSON.parse(await file.text());
      const lista = parsed.notas ?? parsed.notes;
      const tiempoDe = nota => nota.tiempoMs ?? nota.timeMs;
      const carrilDe = nota => nota.carril ?? nota.lane;
      if (!Array.isArray(lista) || lista.some(nota =>
        !Number.isFinite(+tiempoDe(nota)) || !Number.isInteger(+carrilDe(nota)) ||
        +carrilDe(nota) < 0 || +carrilDe(nota) > 3
      )) throw new Error('Formato de notas incorrecto');
      chart = {...chartDefault, ...parsed, notes: lista.map(nota => ({
        timeMs: Number(tiempoDe(nota)), lane: Number(carrilDe(nota))
      }))};
      resetNotes(); reset();
      setFeedback(`MAPA CARGADO: ${chart.notes.length} NOTAS`);
    } catch(err) {
      setFeedback('NO SE PUDO LEER EL MAPA','#ff687e'); console.error(err);
    }
  });
  refreshKeyButtons();
  resetNotes();
})();
