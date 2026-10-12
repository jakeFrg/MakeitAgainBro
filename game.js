(() => {
  // Chart de respaldo para que el juego también funcione sin cargar un archivo JSON.
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

  // Flechas por carril. Espacio se reserva para activar el impulso.
  const defaultLaneKeys = ['ArrowLeft','ArrowDown','ArrowUp','ArrowRight'];
  const laneNames = ['Carril 1','Carril 2','Carril 3','Carril 4'];
  const arrows = ['←','↓','↑','→'];
  const laneColors = ['#50e7f2','#ff4db8','#a989ff','#ffd65a'];
  const topLaneCenters = [35,45,55,65];
  let laneKeys = [...defaultLaneKeys];
  let bindingLane = null;

  // Referencias a los elementos que se actualizan durante la partida.
  const stage = document.querySelector('#stage');
  const notesBox = document.querySelector('#notes');
  const scoreEl = document.querySelector('#score');
  const comboEl = document.querySelector('#combo');
  const clockEl = document.querySelector('#clock');
  const feedback = document.querySelector('#feedback');
  const message = document.querySelector('#stageMessage');
  const boostFill = document.querySelector('#boostFill');
  const boostStatus = document.querySelector('#boostStatus');
  const boostButton = document.querySelector('#boostButton');
  const boostMeter = document.querySelector('.boost-meter');

  // Estado de la partida, reloj de audio, puntuación y energía del impulso.
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
  let leadMs = 1800;
  let energy = 0;
  let boostActiveUntil = -1;
  const hitWindowMs = 150;
  const boostCost = 50;
  const boostDurationMs = 8000;

  // Convierte notas del JSON a elementos visibles en el tablero.
  function resetNotes() {
    notesBox.replaceChildren();
    notes = chart.notes.map((note, index) => {
      const element = document.createElement('div');
      const isBoost = Boolean(note.impulso ?? note.boost);
      element.className = isBoost ? 'note boost-note' : 'note';
      element.textContent = '';
      element.style.setProperty('--note-color', laneColors[note.lane]);
      element.hidden = true;
      notesBox.appendChild(element);
      return {
        timeMs: Number(note.timeMs),
        lane: Number(note.lane),
        boost: isBoost,
        element,
        hit: false,
        missed: false,
        id: index
      };
    }).sort((a,b) => a.timeMs - b.timeMs);
  }

  // Muestra el nombre legible de una tecla en el panel de asignación.
  function keyLabel(key) {
    const labels = {ArrowLeft:'←',ArrowDown:'↓',ArrowUp:'↑',ArrowRight:'→'};
    return labels[key] || (key.length === 1 ? key.toUpperCase() : key);
  }

  function refreshKeyButtons() {
    document.querySelectorAll('.key-bind').forEach(button => {
      const lane = Number(button.dataset.bindLane);
      button.textContent = keyLabel(laneKeys[lane]);
      button.classList.toggle('waiting', bindingLane === lane);
    });
  }

  // Devuelve la posición de la canción. Durante la cuenta previa puede ser negativa.
  function chartTime() {
    if (!running) return pausedAt;
    if (preRoll) return performance.now() - preRollStartedAt - leadMs;
    return audio ? audio.currentTime * 1000 : performance.now() - startedAt;
  }

  function setFeedback(text, color='var(--cyan)') {
    feedback.textContent = text;
    feedback.style.color = color;
  }

  function updateScore() {
    scoreEl.textContent = String(score).padStart(6,'0');
    comboEl.innerHTML = `${combo}<span class="small">×</span>`;
  }

  function formatTime(ms) {
    const seconds = Math.max(0,Math.floor(ms / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
  }

  // Actualiza la barra, el porcentaje y el boton para activar el multiplicador.
  function updateBoostUI(time=chartTime()) {
    const active = boostActiveUntil >= 0 && time < boostActiveUntil;
    const percent = Math.max(0,Math.min(100,energy));
    boostFill.style.width = `${percent}%`;
    boostMeter.setAttribute('aria-valuenow',String(Math.round(percent)));
    boostStatus.textContent = active ? 'X2' : `${Math.round(percent)}%`;
    boostButton.disabled = active || energy < boostCost;
    boostButton.classList.toggle('ready',!active && energy >= boostCost);
    boostButton.classList.toggle('active',active);
    boostButton.textContent = active
      ? `IMPULSO X2 · ${Math.ceil((boostActiveUntil-time)/1000)} S`
      : energy >= boostCost ? 'ACTIVAR · ESPACIO' : 'CARGA AL 50%';
  }

  // Consume energia y duplica los puntos durante ocho segundos.
  function activateBoost() {
    const time = chartTime() + (chart.offsetMs || 0);
    if (!running) return;
    if (time < boostActiveUntil) return;
    if (energy < boostCost) {
      setFeedback('NECESITAS 50% DE IMPULSO','#ffd65a');
      return;
    }
    energy = 0;
    boostActiveUntil = time + boostDurationMs;
    stage.classList.add('boost-active');
    updateBoostUI(time);
    setFeedback('¡IMPULSO ACTIVADO! · PUNTOS X2','#ffd65a');
  }

  // Bucle de animacion: dibuja gemas en perspectiva y acompasa el audio.
  function frame(now) {
    requestAnimationFrame(frame);
    if (!running) return;

    // La cuenta previa permite que las primeras gemas entren desde la parte superior.
    if (preRoll && now - preRollStartedAt >= leadMs) {
      preRoll = false;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => setFeedback('NO SE PUDO REPRODUCIR EL MP3','#ff687e'));
      }
      startedAt = performance.now();
      setFeedback('¡A JUGAR!');
    }

    const time = chartTime();
    const songTime = time + (chart.offsetMs || 0);
    if (audio && !preRoll && audio.ended) {
      running = false;
      pausedAt = time;
      setFeedback('FIN · REINICIA PARA JUGAR');
      message.hidden = false;
      message.innerHTML = '¡BUEN JUEGO!<br><small>REINICIA PARA VOLVER A EMPEZAR</small>';
      return;
    }

    clockEl.textContent = preRoll
      ? `EN ${Math.ceil((leadMs - (now - preRollStartedAt))/1000)}`
      : formatTime(time);

    if (boostActiveUntil >= 0 && songTime >= boostActiveUntil) {
      boostActiveUntil = -1;
      stage.classList.remove('boost-active');
      setFeedback('IMPULSO TERMINADO');
    }
    updateBoostUI(songTime);

    const height = stage.clientHeight;
    const hitY = height - 76;
    const travel = hitY + 48;

    for (const note of notes) {
      if (note.hit || note.missed) continue;
      const untilHit = note.timeMs - (chart.offsetMs || 0) - time;
      if (untilHit < -hitWindowMs) {
        note.missed = true;
        note.element.remove();
        combo = 0;
        updateScore();
        setFeedback('FALLO','#ff687e');
        continue;
      }

      note.element.hidden = untilHit > leadMs;
      if (note.element.hidden) continue;

      // Mezcla la alineación estrecha de arriba con la separación amplia de abajo.
      const y = hitY - (untilHit / leadMs) * travel;
      const progress = Math.max(0,Math.min(1,(y + 48) / travel));
      const topX = topLaneCenters[note.lane];
      const bottomX = (note.lane + .5) * 25;
      const x = topX + (bottomX - topX) * progress;
      note.element.style.left = `${x}%`;
      note.element.style.top = `${y}px`;
    }
  }
  requestAnimationFrame(frame);

  // Reinicia el mapa y reproduce el MP3 despues de la cuenta previa.
  function start() {
    if (running) return;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    energy = 0;
    boostActiveUntil = -1;
    stage.classList.remove('boost-active');
    preRoll = true;
    preRollStartedAt = performance.now();
    startedAt = preRollStartedAt;
    pausedAt = -leadMs;
    running = true;
    score = 0;
    combo = 0;
    updateScore();
    resetNotes();
    updateBoostUI(-leadMs);
    message.hidden = true;
    setFeedback('PREPÁRATE');
  }

  // Detiene la partida y restaura el tablero y sus barras.
  function reset() {
    running = false;
    preRoll = false;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    pausedAt = 0;
    score = 0;
    combo = 0;
    energy = 0;
    boostActiveUntil = -1;
    stage.classList.remove('boost-active');
    updateScore();
    clockEl.textContent = '00:00';
    resetNotes();
    updateBoostUI(0);
    message.hidden = false;
    message.innerHTML = 'PULSA EMPEZAR<br><small>Y PREPÁRATE</small>';
    setFeedback('LISTO');
  }

  // Comprueba la nota cercana, suma puntos y carga energia al acertar.
  function pressLane(lane) {
    if (!running) return;
    const time = chartTime() + (chart.offsetMs || 0);
    const candidate = notes
      .filter(note => note.lane === lane && !note.hit && !note.missed)
      .sort((a,b) => Math.abs(a.timeMs-time) - Math.abs(b.timeMs-time))[0];

    const receptor = document.querySelector(`.receptor[data-lane="${lane}"]`);
    receptor.classList.add('active');
    setTimeout(() => receptor.classList.remove('active'),100);

    if (candidate && Math.abs(candidate.timeMs-time) <= hitWindowMs) {
      candidate.hit = true;
      candidate.element.remove();
      combo++;
      const active = boostActiveUntil >= 0 && time < boostActiveUntil;
      score += (combo % 10 === 0 ? 150 : 100) * (active ? 2 : 1);
      if (candidate.boost) energy = Math.min(100,energy + 25);
      updateScore();
      updateBoostUI(time);
      if (candidate.boost) setFeedback('¡NOTA DE IMPULSO! +25%','#ffd65a');
      else setFeedback(Math.abs(candidate.timeMs-time) < 55 ? '¡PERFECTO!' : '¡BIEN!');
    } else {
      combo = 0;
      updateScore();
      setFeedback('FALLO','#ff687e');
    }
  }

  // En modo asignacion, la siguiente tecla queda vinculada al carril seleccionado.
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

  // Los botones de carril inician la captura y permiten restaurar las flechas.
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

  // La velocidad seleccionada es el tiempo que tarda una gema en recorrer la pista.
  document.querySelector('#difficulty').addEventListener('change',event => {
    leadMs = Number(event.target.value);
  });
  document.querySelector('#startButton').addEventListener('click',start);
  document.querySelector('#resetButton').addEventListener('click',reset);
  document.querySelector('#boostButton').addEventListener('click',activateBoost);

  // Carga un MP3 local. El audio es el reloj principal del mapa de notas.
  document.querySelector('#audioFile').addEventListener('change',event => {
    const file = event.target.files[0];
    if (!file) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(file);
    if (audio) audio.pause();
    audio = new Audio(audioUrl);
    document.querySelector('#audioName').textContent = file.name;
    reset();
  });

  // Acepta el formato en español del JSON y tambien el formato anterior en ingles.
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
        ...chartDefault,
        offsetMs: Number(parsed.desfaseMs ?? parsed.offsetMs ?? chartDefault.offsetMs),
        notes: list.map(note => ({
          timeMs: Number(timeOf(note)),
          lane: Number(laneOf(note)),
          boost: Boolean(note.impulso ?? note.boost)
        }))
      };
      resetNotes();
      reset();
      setFeedback(`MAPA CARGADO: ${chart.notes.length} NOTAS`);
    } catch (error) {
      setFeedback('NO SE PUDO LEER EL MAPA','#ff687e');
      console.error(error);
    }
  });

  // Deja listos los controles, el mapa de respaldo y el medidor al abrir la pagina.
  refreshKeyButtons();
  resetNotes();
  updateBoostUI(0);
})();
