(() => {
  // Chart de respaldo para que el juego funcione sin cargar un JSON aparte.
  const chartDefault = {
    offsetMs: 0,
    notes: [
      {timeMs:1000,lane:0},{timeMs:1500,lane:2},{timeMs:2000,lane:1},{timeMs:2500,lane:3},
      {timeMs:3000,lane:0},{timeMs:3250,lane:2,boost:true},{timeMs:3500,lane:1},{timeMs:4000,lane:3},
      {timeMs:4500,lane:2},{timeMs:5000,lane:0},{timeMs:5500,lane:1},{timeMs:5750,lane:3},
      {timeMs:6000,lane:2},{timeMs:6500,lane:0},{timeMs:7000,lane:3,boost:true},{timeMs:7500,lane:1},
      {timeMs:8000,lane:0},{timeMs:8250,lane:1},{timeMs:8500,lane:2},{timeMs:9000,lane:3},
      {timeMs:9500,lane:1},{timeMs:10000,lane:2},{timeMs:10500,lane:0},{timeMs:11000,lane:3},
      {timeMs:11500,lane:2},{timeMs:11750,lane:0,boost:true},{timeMs:12000,lane:1},{timeMs:12500,lane:3},
      {timeMs:13000,lane:0},{timeMs:13500,lane:2},{timeMs:14000,lane:1},{timeMs:14500,lane:3},
      {timeMs:15000,lane:2},{timeMs:15500,lane:1,boost:true},{timeMs:15750,lane:3},{timeMs:16000,lane:0}
    ]
  };

  // Controles por carril; Espacio se reserva para activar el impulso.
  const defaultLaneKeys = ['ArrowLeft','ArrowDown','ArrowUp','ArrowRight'];
  const laneNames = ['Carril 1','Carril 2','Carril 3','Carril 4'];
  const laneColors = ['#50e7f2','#ff4db8','#a989ff','#ffd65a'];
  const topLaneCenters = [35,45,55,65];
  let laneKeys = [...defaultLaneKeys];
  let bindingLane = null;

  // Elementos que se actualizan durante la partida.
  const stage = document.querySelector('#stage');
  const notesBox = document.querySelector('#notes');
  const scoreEl = document.querySelector('#score');
  const comboEl = document.querySelector('#combo');
  const multiplierEl = document.querySelector('#comboMultiplier');
  const clockEl = document.querySelector('#clock');
  const feedback = document.querySelector('#feedback');
  const message = document.querySelector('#stageMessage');
  const judgementDisplay = document.querySelector('#judgementDisplay');
  const boostFill = document.querySelector('#boostFill');
  const boostStatus = document.querySelector('#boostStatus');
  const boostMeter = document.querySelector('.boost-meter');
  const optionsMenu = document.querySelector('#optionsMenu');

  // Relojes, puntuación, sonido y energía del impulso.
  let chart = chartDefault;
  let notes = [];
  let running = false;
  let preRoll = false;
  let startedAt = 0;
  let preRollStartedAt = 0;
  let pausedAt = 0;
  let score = 0;
  let combo = 0;
  let audio = null;
  let audioUrl = null;
  let soundContext = null;
  let leadMs = 1800;
  let energy = 0;
  let boostActiveUntil = -1;
  let boostLastTickAt = -1;
  const hitWindowMs = 150;
  const boostCost = 50;
  const boostDurationMs = 8000;

  // Convierte las entradas del mapa en gemas dibujadas sobre la pista.
  function resetNotes() {
    notesBox.replaceChildren();
    notes = chart.notes.map((note,index) => {
      const element = document.createElement('div');
      const isBoost = Boolean(note.impulso ?? note.boost);
      element.className = isBoost ? 'note boost-note' : 'note';
      element.hidden = true;
      element.style.setProperty('--note-color',laneColors[note.lane]);
      notesBox.appendChild(element);
      return {
        timeMs:Number(note.timeMs),
        lane:Number(note.lane),
        boost:isBoost,
        element,
        hit:false,
        missed:false,
        id:index
      };
    }).sort((a,b) => a.timeMs-b.timeMs);
  }

  // Nombra las teclas de forma breve en el menú de opciones.
  function keyLabel(key) {
    const labels = {ArrowLeft:'←',ArrowDown:'↓',ArrowUp:'↑',ArrowRight:'→'};
    return labels[key] || (key.length === 1 ? key.toUpperCase() : key);
  }

  function refreshKeyButtons() {
    document.querySelectorAll('.key-bind').forEach(button => {
      const lane = Number(button.dataset.bindLane);
      button.textContent = keyLabel(laneKeys[lane]);
      button.classList.toggle('waiting',bindingLane === lane);
    });
  }

  // Devuelve el tiempo de canción, negativo durante la cuenta previa.
  function chartTime() {
    if (!running) return pausedAt;
    if (preRoll) return performance.now()-preRollStartedAt-leadMs;
    return audio ? audio.currentTime*1000 : performance.now()-startedAt;
  }

  function setFeedback(text,color='var(--cyan)') {
    feedback.textContent = text;
    feedback.style.color = color;
  }

  // Muestra por un instante la calidad temporal del golpe en la esquina libre.
  function showJudgement(label,color) {
    judgementDisplay.textContent = label;
    judgementDisplay.style.color = color;
    judgementDisplay.classList.remove('show');
    void judgementDisplay.offsetWidth;
    judgementDisplay.classList.add('show');
  }

  // Combo: x1 antes de 10 aciertos, x2 desde 10, x4 desde 20 y x8 desde 30.
  function comboTier() {
    if (combo >= 30) return 8;
    if (combo >= 20) return 4;
    if (combo >= 10) return 2;
    return 1;
  }

  function currentMultiplier(time=chartTime()+(chart.offsetMs||0)) {
    const boostIsActive = boostActiveUntil >= 0 && time < boostActiveUntil;
    return comboTier() * (boostIsActive ? 2 : 1);
  }

  function updateScore(time=chartTime()+(chart.offsetMs||0)) {
    scoreEl.textContent = String(score).padStart(6,'0');
    comboEl.textContent = String(combo);
    multiplierEl.textContent = `x${currentMultiplier(time)}`;
    multiplierEl.dataset.tier = String(comboTier());
    multiplierEl.classList.toggle('boosted',boostActiveUntil >= 0 && time < boostActiveUntil);
  }

  function formatTime(ms) {
    const seconds = Math.max(0,Math.floor(ms/1000));
    return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  }

  // Beeps sintéticos cortos con volumen bajo para acierto y fallo.
  function playFeedbackSound(success) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!soundContext) soundContext = new AudioContextClass();
      if (soundContext.state === 'suspended') soundContext.resume();

      const now = soundContext.currentTime;
      const oscillator = soundContext.createOscillator();
      const volume = soundContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(success ? 760 : 220,now);
      oscillator.frequency.exponentialRampToValueAtTime(success ? 540 : 155,now+0.075);
      volume.gain.setValueAtTime(success ? 0.018 : 0.012,now);
      volume.gain.exponentialRampToValueAtTime(0.0001,now+0.095);
      oscillator.connect(volume);
      volume.connect(soundContext.destination);
      oscillator.start(now);
      oscillator.stop(now+0.1);
    } catch (error) {
      // El juego puede continuar aunque el navegador no permita generar sonido.
    }
  }

  // Actualiza el relleno y el porcentaje visible de la barra de impulso.
  function updateBoostUI(time=chartTime()+(chart.offsetMs||0)) {
    const percent = Math.max(0,Math.min(100,energy));
    boostFill.style.width = `${percent}%`;
    boostMeter.setAttribute('aria-valuenow',String(Math.round(percent)));
    boostStatus.textContent = `${Math.round(percent)}%`;
  }

  // Activa el doble multiplicador; la carga se consume gradualmente durante ocho segundos.
  function activateBoost() {
    const time = chartTime()+(chart.offsetMs||0);
    if (!running || time < boostActiveUntil) return;
    if (energy < boostCost) {
      setFeedback('NECESITAS 50% DE IMPULSO','#ffd65a');
      return;
    }
    boostActiveUntil = time+boostDurationMs;
    boostLastTickAt = time;
    stage.classList.add('boost-active');
    updateBoostUI(time);
    updateScore(time);
    setFeedback('¡IMPULSO ACTIVADO!','#ffd65a');
  }

  // Animación: da perspectiva a la pista y sincroniza las notas con el audio.
  function frame(now) {
    requestAnimationFrame(frame);
    if (!running) return;

    // La cuenta previa permite que las primeras gemas entren por el borde superior de la pista.
    if (preRoll && now-preRollStartedAt >= leadMs) {
      preRoll = false;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => setFeedback('NO SE PUDO REPRODUCIR EL MP3','#ff687e'));
      }
      startedAt = performance.now();
      setFeedback('¡A JUGAR!');
    }

    const time = chartTime();
    const songTime = time+(chart.offsetMs||0);
    if (audio && !preRoll && audio.ended) {
      running = false;
      pausedAt = time;
      setFeedback('FIN · REINICIA PARA JUGAR');
      message.hidden = false;
      message.innerHTML = '¡BUEN JUEGO!<br><small>REINICIA PARA VOLVER A EMPEZAR</small>';
      return;
    }

    clockEl.textContent = preRoll ? `EN ${Math.ceil((leadMs-(now-preRollStartedAt))/1000)}` : formatTime(time);
    if (boostActiveUntil >= 0 && songTime < boostActiveUntil) {
      if (boostLastTickAt >= 0) {
        const elapsed = Math.max(0,songTime-boostLastTickAt);
        energy = Math.max(0,energy-(elapsed*boostCost/boostDurationMs));
      }
      boostLastTickAt = songTime;
    } else if (boostActiveUntil >= 0 && songTime >= boostActiveUntil) {
      energy = 0;
      boostActiveUntil = -1;
      boostLastTickAt = -1;
      stage.classList.remove('boost-active');
      setFeedback('IMPULSO TERMINADO');
      updateScore(songTime);
    }
    updateBoostUI(songTime);

    const height = stage.clientHeight;
    const hitY = height-76;
    const entryY = height*0.4;
    const travel = hitY-entryY;
    for (const note of notes) {
      if (note.hit || note.missed) continue;
      const untilHit = note.timeMs-(chart.offsetMs||0)-time;
      if (untilHit < -hitWindowMs) {
        note.missed = true;
        note.element.remove();
        combo = 0;
        updateScore(songTime);
        setFeedback('FALLO','#ff687e');
        showJudgement('MALO','#ff687e');
        playFeedbackSound(false);
        continue;
      }
      note.element.hidden = untilHit > leadMs;
      if (note.element.hidden) continue;

      // La nota se estrecha arriba y se alinea con su receptor al llegar abajo.
      const y = hitY-(untilHit/leadMs)*travel;
      const progress = Math.max(0,Math.min(1,(y-entryY)/travel));
      const topX = [35,45,55,65][note.lane];
      const bottomX = 2+(note.lane+0.5)*24;
      note.element.style.left = `${topX+(bottomX-topX)*progress}%`;
      note.element.style.top = `${y}px`;
    }
  }
  requestAnimationFrame(frame);

  // Inicia una ronda y reinicia el multiplicador, audio y notas.
  function start() {
    if (running) return;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    energy = 0;
    boostActiveUntil = -1;
    boostLastTickAt = -1;
    stage.classList.remove('boost-active');
    preRoll = true;
    preRollStartedAt = performance.now();
    startedAt = preRollStartedAt;
    pausedAt = -leadMs;
    running = true;
    score = 0;
    combo = 0;
    updateScore(-leadMs);
    resetNotes();
    updateBoostUI(-leadMs);
    message.hidden = true;
    setFeedback('PREPÁRATE');
  }

  // Detiene el juego y devuelve las barras a su estado inicial.
  function reset() {
    running = false;
    preRoll = false;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    pausedAt = 0;
    score = 0;
    combo = 0;
    energy = 0;
    boostActiveUntil = -1;
    boostLastTickAt = -1;
    stage.classList.remove('boost-active');
    updateScore(0);
    clockEl.textContent = '00:00';
    resetNotes();
    updateBoostUI(0);
    message.hidden = false;
    message.textContent = '';
    message.hidden = true;
    setFeedback('LISTO');
  }

  // Busca la nota más cercana y evalúa si el jugador acertó.
  function pressLane(lane) {
    if (!running) return;
    const time = chartTime()+(chart.offsetMs||0);
    const candidate = notes
      .filter(note => note.lane === lane && !note.hit && !note.missed)
      .sort((a,b) => Math.abs(a.timeMs-time)-Math.abs(b.timeMs-time))[0];
    const receptor = document.querySelector(`.receptor[data-lane="${lane}"]`);
    receptor.classList.add('active');
    setTimeout(() => receptor.classList.remove('active'),100);

    const timingError = candidate ? Math.abs(candidate.timeMs-time) : Infinity;
    if (candidate && timingError <= hitWindowMs) {
      candidate.hit = true;
      candidate.element.remove();
      combo++;
      const multiplier = currentMultiplier(time);
      const judgement = timingError <= 35
        ? {label:'EXCELENTE',points:150,color:'#a989ff'}
        : timingError <= 75
          ? {label:'BUENO',points:120,color:'#50e7f2'}
          : timingError <= 115
            ? {label:'BIEN',points:90,color:'#ffd65a'}
            : {label:'MALO',points:50,color:'#ff687e'};
      score += (combo % 10 === 0 ? judgement.points+50 : judgement.points)*multiplier;
      if (candidate.boost) energy = Math.min(100,energy+25);
      updateScore(time);
      updateBoostUI(time);
      showJudgement(judgement.label,judgement.color);
      setFeedback(candidate.boost ? '¡NOTA ESPECIAL! +25% IMPULSO' : '¡ACIERTO!');
      playFeedbackSound(true);
    } else {
      combo = 0;
      updateScore(time);
      setFeedback('FALLO','#ff687e');
      showJudgement('MALO','#ff687e');
      playFeedbackSound(false);
    }
  }

  // Permite reasignar carriles; Espacio queda reservado para el impulso.
  document.addEventListener('keydown',event => {
    if (bindingLane !== null) {
      event.preventDefault();
      if (event.key === 'Escape') {
        bindingLane = null;
        refreshKeyButtons();
        setFeedback('ASIGNACION CANCELADA');
        return;
      }
      if (event.code === 'Space') {
        setFeedback('ESPACIO ESTA RESERVADO PARA IMPULSO','#ffd65a');
        return;
      }
      const newKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (laneKeys.some((key,index) => key === newKey && index !== bindingLane)) {
        setFeedback('ESA TECLA YA ESTA ASIGNADA','#ff687e');
        return;
      }
      laneKeys[bindingLane] = newKey;
      bindingLane = null;
      refreshKeyButtons();
      setFeedback(`TECLA ASIGNADA: ${keyLabel(newKey)}`);
      return;
    }
    if (event.code === 'Space') {
      event.preventDefault();
      activateBoost();
      return;
    }
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const lane = laneKeys.indexOf(key);
    if (lane !== -1) {
      event.preventDefault();
      pressLane(lane);
    }
  });

  // Botones del menú de opciones para capturar o restaurar teclas.
  document.querySelectorAll('.key-bind').forEach(button => button.addEventListener('click',() => {
    bindingLane = Number(button.dataset.bindLane);
    refreshKeyButtons();
    setFeedback(`PULSA UNA TECLA PARA ${laneNames[bindingLane].toUpperCase()}`,'#ffd65a');
  }));
  document.querySelector('#defaultKeys').addEventListener('click',() => {
    laneKeys = [...defaultLaneKeys];
    bindingLane = null;
    refreshKeyButtons();
    setFeedback('FLECHAS RESTAURADAS');
  });

  // Velocidad, controles principales y botón de impulso.
  document.querySelector('#difficulty').addEventListener('change',event => { leadMs = Number(event.target.value); });
  document.querySelector('#startButton').addEventListener('click',() => {
    optionsMenu.open = false;
    start();
  });
  document.querySelector('#resetButton').addEventListener('click',() => {
    optionsMenu.open = false;
    reset();
  });

  // Carga el audio seleccionado y cierra el menú de opciones.
  document.querySelector('#audioFile').addEventListener('change',event => {
    const file = event.target.files[0];
    if (!file) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(file);
    if (audio) audio.pause();
    audio = new Audio(audioUrl);
    document.querySelector('#audioName').textContent = file.name;
    optionsMenu.open = false;
    reset();
  });

  // Carga un mapa JSON en español o conserva compatibilidad con campos anteriores.
  document.querySelector('#chartFile').addEventListener('change',async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const list = parsed.notas ?? parsed.notes;
      const timeOf = note => note.tiempoMs ?? note.timeMs;
      const laneOf = note => note.carril ?? note.lane;
      if (!Array.isArray(list) || list.some(note =>
        !Number.isFinite(+timeOf(note)) || !Number.isInteger(+laneOf(note)) ||
        +laneOf(note) < 0 || +laneOf(note) > 3
      )) throw new Error('Formato de notas incorrecto');
      chart = {
        offsetMs:Number(parsed.desfaseMs ?? parsed.offsetMs ?? chartDefault.offsetMs),
        notes:list.map(note => ({
          timeMs:Number(timeOf(note)),
          lane:Number(laneOf(note)),
          boost:Boolean(note.impulso ?? note.boost)
        }))
      };
      resetNotes();
      reset();
      optionsMenu.open = false;
      setFeedback(`MAPA CARGADO: ${chart.notes.length} NOTAS`);
    } catch (error) {
      setFeedback('NO SE PUDO LEER EL MAPA','#ff687e');
      console.error(error);
    }
  });

  // Prepara el mapa, controles y medidor al abrir la página.
  refreshKeyButtons();
  resetNotes();
  updateScore(0);
  updateBoostUI(0);
})();
