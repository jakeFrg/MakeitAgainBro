// Maneja el menú principal, la introducción de historia, los créditos, las opciones, el leaderboard y la práctica.
(() => {
  'use strict';

  /* ==========================================================================
     1. CONFIGURACIÓN
     ========================================================================== */

  const SCENE_ANIMATION_MS = 350;
  const COMIC_BY_NEXT_STAGE = {
    1:[
      {label:'CAPÍTULO 02 · PRIMER CONCIERTO',title:'UNA OPORTUNIDAD',text:'Después de practicar, llega tu primer concierto. La multitud espera.',image:'ART/assets/escenario1.jpeg'},
      {label:'CAPÍTULO 02 · PRIMER CONCIERTO',title:'QUE NO PARE LA MÚSICA',text:'Toma aire, sigue las notas y demuestra lo que puedes hacer.'}
    ],
    2:[
      {label:'CAPÍTULO 03 · NUEVAS MIRADAS',title:'MÁS PÚBLICO',text:'Tu presentación corrió la voz. Una nueva audiencia se reúne para verte.',image:'ART/assets/escenario1.jpeg'},
      {label:'CAPÍTULO 03 · NUEVAS MIRADAS',title:'SUBE AL ESCENARIO',text:'Las luces se encienden. Mantén el ritmo y conquista a la multitud.'}
    ],
    3:[
      {label:'CAPÍTULO 04 · EL GRAN SHOW',title:'LA NOCHE FINAL',text:'El escenario más grande de la ciudad se abre ante ti.',image:'ART/assets/escenario1.jpeg'},
      {label:'CAPÍTULO 04 · EL GRAN SHOW',title:'TODO O NADA',text:'Esta es tu última canción. Haz que todos la recuerden.'}
    ]
  };
  const FINAL_COMIC = [
    {label:'EPÍLOGO',title:'UNA NOCHE PARA RECORDAR',text:'La última nota resuena y el público estalla en aplausos.',image:'ART/assets/escenario1.jpeg'},
    {label:'EPÍLOGO',title:'EL SHOW CONTINÚA',text:'Tu historia apenas comienza. Gracias por jugar.'}
  ];

  // Introducción narrativa: una sola página de cómic (Comic1.png) con cuatro
  // viñetas. El visor recorta la viñeta activa de la página; no hay imágenes
  // individuales. Los rectángulos están medidos sobre la imagen original.
  const INTRO_COMIC_PAGE = {width:1672,height:941};
  const INTRO_COMIC_PANELS = [
    {x:12,y:12,width:816,height:452},                       // noticiero
    {x:850,y:12,width:808,height:452},                      // manager y ElMiMAO$
    {x:12,y:481,width:828,height:448},                      // manager en la consola
    {                                                       // ElMiMAO$ y el micrófono
      x:900,y:481,width:758,height:448,
      clip:'polygon(0 0, 100% 0, 100% 100%, 21.4% 100%, 0 25.6%)'
    }
  ];

  // Cada entrada es un clic. La burbuja se mide en porcentajes de la viñeta:
  // left/top/width colocan el globo y tail fija dónde nace la cola y hacia
  // dónde apunta (flip 1 = izquierda, -1 = derecha).
  const INTRO_COMIC_DIALOGUES = [
    {panel:0,speaker:'Presentador',text:'Buenas tardes y muy buenas noticias.',
      bubble:{left:1.5,top:2.5,width:31,tail:{x:84,flip:1}}},
    {panel:0,speaker:'Presentador',text:'Estamos a unas horas de que se presente el artista más grande de todos los tiempos.',
      bubble:{left:30,top:2.5,width:40,tail:{x:12,flip:1}}},
    {panel:0,speaker:'Presentador',text:'En el estadio ElMiMAO$ Center, un escenario creado para él, ya que ninguno puede contener a sus fans.',
      bubble:{left:1.5,top:2,width:37,tail:{x:82,flip:1}}},
    {panel:0,speaker:'Presentador',text:'¿Ya tienen sus boletos? Yo ya tengo el mío en VIP. ¡Cómo amo a ese tipo!',
      bubble:{left:27,top:1.5,width:39,tail:{x:15,flip:1}}},

    {panel:1,speaker:'Manager',text:'Bro, estás a unas horas de hacer la presentación de tu vida y aún no has practicado.',
      bubble:{left:1.5,top:1.5,width:46,tail:{x:76,flip:-1}}},
    {panel:1,speaker:'ElMiMAO$',text:'¿Practicar? Yo nací para esto, no necesito practicar.',
      bubble:{left:42.5,top:2,width:20,tail:{x:90,flip:-1}}},
    {panel:1,speaker:'Manager',text:'¡Sí lo necesitas! Como falles, este concierto arruinará tu carrera.',
      bubble:{left:1,top:2,width:42,tail:{x:78,flip:-1}}},
    {panel:1,speaker:'ElMiMAO$',text:'Tranquilo, bro, todo va a salir bien.',
      bubble:{left:42,top:18.5,width:20.5,tail:{x:90,flip:-1}}},
    {panel:1,speaker:'Manager',text:'Mínimo sigamos grabando la nueva canción. Se supone que la tenemos que entregar para ese jueguito que va a salir... Mmm, algo de autos, no sé muy bien de qué era.',
      bubble:{left:.7,top:.8,width:52,tail:{x:74,flip:-1}}},
    {panel:1,speaker:'ElMiMAO$',text:'Está bien, vamos.',
      bubble:{left:44,top:2.5,width:19,tail:{x:88,flip:-1}}},

    {panel:2,speaker:'Manager',text:'Bueno, retomemos donde lo dejamos la última vez. ¿Listo?',
      bubble:{left:17,top:1.5,width:39,tail:{x:30,flip:1}}},

    {panel:3,speaker:'ElMiMAO$',text:'¡LISTO!',
      bubble:{left:4,top:3,width:20,tail:{x:94,flip:-1}}}
  ];

  // Cómic 2: se muestra después de la primera canción de la campaña. La página
  // también es una rejilla 2x2, pero solo la primera viñeta lleva diálogos.
  // Los rectángulos se midieron sobre Comic2.png (1672x941).
  const COMIC_2_PAGE = {width:1672,height:941};
  const COMIC_2_PANELS = [
    {x:5,y:5,width:822,height:456},    // ElMiMAO$ subiendo al jet; aquí van los diálogos
    {x:844,y:5,width:823,height:456},  // el jet en pleno vuelo
    {x:5,y:478,width:822,height:458},  // llegada al hospital
    {x:844,y:478,width:823,height:458} // habitación del hospital
  ];

  // Manager queda a la izquierda (de espaldas) y ElMiMAO$ a la derecha,
  // subiendo las escaleras. Los globos se colocan arriba de cada uno y la
  // cola apunta hacia su rostro; las viñetas posteriores no llevan diálogo.
  const COMIC_2_DIALOGUES = [
    {panel:0,speaker:'ElMiMAO$',text:'Me tengo que ir ya.',
      bubble:{left:40,top:7,width:22,tail:{x:92,flip:-1}}},
    {panel:0,speaker:'Manager',text:'Pero aún faltan horas para el concierto.',
      bubble:{left:2,top:24,width:23.5,tail:{x:96,flip:-1}}},
    {panel:0,speaker:'ElMiMAO$',text:'Sí, pero tengo que ir a comprarme una nueva gorra en Los Ángeles.',
      bubble:{left:36,top:5,width:25,tail:{x:95,flip:-1}}},
    {panel:0,speaker:'Manager',text:'Pero Los Ángeles está a una hora de aquí. Puedes ir en coche.',
      bubble:{left:1.5,top:21,width:24,tail:{x:97,flip:-1}}},
    {panel:0,speaker:'ElMiMAO$',text:'¿De qué sirve tener un jet privado si no lo usas?',
      bubble:{left:39,top:8,width:23,tail:{x:94,flip:-1}}}
  ];

  // Los dos cómics comparten el mismo motor: página, viñetas y diálogos.
  const INTRO_COMIC = {
    image:'ART/comics/Comic1.png',
    alt:'Página de cómic de la introducción de ElMiMAO$',
    page:INTRO_COMIC_PAGE,
    panels:INTRO_COMIC_PANELS,
    dialogues:INTRO_COMIC_DIALOGUES
  };

  const COMIC_2 = {
    image:'ART/comics/Comic2.png',
    alt:'Página de cómic: ElMiMAO$ se va en su jet privado',
    page:COMIC_2_PAGE,
    panels:COMIC_2_PANELS,
    dialogues:COMIC_2_DIALOGUES
  };

  const MENU_MUSIC_VOLUME_KEY = 'ritmo-menu-music-volume';

  // Resolución de referencia fija del juego. El marco nunca cambia de tamaño;
  // solo se escala de forma proporcional para caber en la ventana.
  const VIEWPORT_WIDTH  = 1920;
  const VIEWPORT_HEIGHT = 1080;

  // Canciones del menú (los archivos de la carpeta Musica). El título es el que muestra la barra.
  const MENU_TRACKS = [
    {title:'Pro-digio',          src:'Musica/Pro-digio.mp3'},
    {title:'Hazlo Otra Vez',     src:'Musica/HazloOtraVez.mp3'},
    {title:'Me Gustan Loquitas', src:'Musica/MeGustanLoquitas.mp3'},
    {title:'No Me Digas Que No', src:'Musica/NoMeDigasQueNo.mp3'}
  ];
  const MENU_MUSIC_ARTIST     = 'ElMiMAO$';
  const NOW_PLAYING_VISIBLE_MS    = 4000; // la barra se queda visible este tiempo
  const NOW_PLAYING_ANIMATION_MS  = 420;  // duración de la entrada y la salida

  // Secciones del menú de opciones: id de su página y título que se muestra.
  const OPTION_PAGES = {
    audio:      {id:'optionAudio',      label:'AUDIO'},
    difficulty: {id:'optionDifficulty', label:'DIFICULTAD'},
    song:       {id:'optionSong',       label:'CANCIÓN Y MAPA'},
    controls:   {id:'optionControls',   label:'CONTROLES'}
  };

  /* ==========================================================================
     2. ELEMENTOS DE LA PÁGINA
     ========================================================================== */

  const $ = selector => document.querySelector(selector);

  // Pantalla de inicio y sus paneles.
  const startScreen       = $('#startScreen');
  const mainMenu          = $('#mainMenu');
  const creditsPanel      = $('#creditsPanel');
  const settingsScreen    = $('#settingsScreen');
  const leaderboardScreen = $('#leaderboardScreen');
  const storyIntro        = $('#storyIntro');
  const panels = [mainMenu, creditsPanel, settingsScreen, leaderboardScreen, storyIntro];

  // Introducción de historia.
  const storyLabel     = $('#storySceneLabel');
  const storyTitle     = $('#storySceneTitle');
  const storyText      = $('#storySceneText');
  const storyPanelNumber = $('#storyPanelNumber');
  const storyContinueHint = $('#storyContinueHint');
  const comicIntroView = $('#comicIntroView');
  const comicPanel     = $('#comicPanel');
  const comicArtClip   = $('#comicArtClip');
  const comicPanelArt  = $('#comicPanelArt');
  const comicCutLine   = $('#comicCutLine');
  const comicBubble    = $('#comicBubble');
  const comicSpeaker   = $('#comicSpeaker');
  const comicDialogue  = $('#comicDialogue');
  const comicTail      = $('#comicTail');
  const comicDialogueCount = $('#comicDialogueCount');

  // Opciones.
  const backFromSettings = $('#backFromSettings');
  const optionsMenu      = $('#optionsMenu');
  const backToOptions    = $('#backToOptions');
  const optionsTitle     = $('#optionsTitle');
  const optionPages      = Array.from(document.querySelectorAll('.option-page'));

  // Música del menú y barra de la canción que suena.
  const menuMusic = $('#musicaMenu');
  const menuMusicVolume = $('#menuMusicVolume');
  const menuMusicVolumeValue = $('#menuMusicVolumeValue');
  const menuNowPlaying = $('#menuNowPlaying');
  const menuSongTitle = $('#menuSongTitle');
  const menuSongArtist = $('#menuSongArtist');
  const menuSongProgress = $('#menuSongProgress');
  const menuSongProgressFill = $('#menuSongProgressFill');

  /* ==========================================================================
     3. ESTADO
     ========================================================================== */

  let comicPages = [];
  let comicIndex = 0;
  let comicFlow = 'intro';
  let activeDialogueComic = null;      // cómic por viñetas que se está mostrando
  let activeDialogueIndex = 0;         // diálogo actual dentro de ese cómic
  let activeDialoguePanel = 0;         // viñeta actual (también después de los diálogos)
  let activeDialogueOnComplete = null; // qué hacer al terminar el cómic

  let menuTrack = null;          // canción del menú que suena ahora
  let introFinished = false;     // la barra solo puede aparecer al acabar la intro
  let nowPlayingTimer = 0;       // oculta la barra tras unos segundos
  let nowPlayingAnimation = null; // animación de entrada o salida en curso

    /* ==========================================================================
     ANIMACIÓN DE EL MIMAO EN EL MENÚ
     ========================================================================== */

  const menuMimao = $('#menuMimao');

  const MIMAO_FRAMES = 16; 
  const MIMAO_FRAME_DURATION = 150; // ms por frame

  let mimaoFrame = 0;  
  let mimaoLastFrame = 0;
  let mimaoAnimationId = 0;

function animateMimao(timestamp) {
    if (mainMenu.hidden || startScreen.hidden) {
        mimaoAnimationId = 0;
        return;
    }

    if (timestamp - mimaoLastFrame >= MIMAO_FRAME_DURATION) {
        mimaoFrame = (mimaoFrame + 1) % MIMAO_FRAMES;
        mimaoLastFrame = timestamp;
    }

    const position = (mimaoFrame / (MIMAO_FRAMES - 1)) * 100;

    menuMimao.style.backgroundPosition = `${position}% 0`;

    mimaoAnimationId = requestAnimationFrame(animateMimao);
}

function startMimaoAnimation() {
    if (!menuMimao) return;
    if (mimaoAnimationId) return;

    mimaoLastFrame = 0;
    mimaoFrame = 0;
    menuMimao.style.backgroundPosition = "0% 0";

    mimaoAnimationId = requestAnimationFrame(animateMimao);
}

function stopMimaoAnimation() {
    if (mimaoAnimationId) {
        cancelAnimationFrame(mimaoAnimationId);
        mimaoAnimationId = 0;
    }

    mimaoFrame = 0;

    if (menuMimao) {
        menuMimao.style.backgroundPosition = "0% 0";
    }
}

// Iniciar si el juego abre directamente en el menú.
if (mainMenu && !mainMenu.hidden) {
    startMimaoAnimation();
}

  /* ==========================================================================
     4. MÚSICA DEL MENÚ
     ========================================================================== */

  // Elige una canción al azar; evita repetir la que acaba de sonar.
  function pickRandomMenuTrack() {
    let options = MENU_TRACKS;
    if (menuTrack && MENU_TRACKS.length > 1) {
      options = MENU_TRACKS.filter(track => track.src !== menuTrack.src);
    }
    return options[Math.floor(Math.random() * options.length)];
  }

  // Avance de la barra según el minuto actual de la canción.
  function updateNowPlayingProgress() {
    const duration = Number.isFinite(menuMusic.duration) ? menuMusic.duration : 0;
    const percent = duration > 0 ? Math.max(0, Math.min(100, menuMusic.currentTime / duration * 100)) : 0;
    menuSongProgressFill.style.width = `${percent}%`;
    menuSongProgress.setAttribute('aria-valuenow', String(Math.round(percent)));
  }

  // Cambia el texto de la barra para la canción indicada.
  function updateNowPlayingInfo(track) {
    menuSongTitle.textContent = track.title;
    menuSongArtist.textContent = MENU_MUSIC_ARTIST;
  }

  // Muestra la barra deslizándola desde la derecha; se oculta sola a los 4 segundos.
  function showNowPlaying(track) {
    if (!introFinished || startScreen.hidden || mainMenu.hidden) return;

    updateNowPlayingInfo(track);
    updateNowPlayingProgress();
    clearTimeout(nowPlayingTimer);
    if (nowPlayingAnimation) {
      nowPlayingAnimation.cancel();
      nowPlayingAnimation = null;
    }

    menuNowPlaying.hidden = false;
    menuNowPlaying.setAttribute('aria-hidden', 'false');

    const animation = menuNowPlaying.animate([
      {transform:'translateX(calc(100% + 32px))', opacity:0},
      {transform:'translateX(0)', opacity:1}
    ], {duration:NOW_PLAYING_ANIMATION_MS, easing:'cubic-bezier(.2,.8,.25,1)', fill:'both'});

    nowPlayingAnimation = animation;
    animation.onfinish = () => {
      if (nowPlayingAnimation !== animation) return;
      nowPlayingTimer = setTimeout(hideNowPlaying, NOW_PLAYING_VISIBLE_MS);
    };
  }

  // Oculta la barra deslizándola a la derecha (o al instante al salir del menú o parar la música).
  function hideNowPlaying(instant = false) {
    clearTimeout(nowPlayingTimer);
    if (nowPlayingAnimation) {
      nowPlayingAnimation.cancel();
      nowPlayingAnimation = null;
    }
    if (menuNowPlaying.hidden) return;

    if (instant) {
      menuNowPlaying.hidden = true;
      menuNowPlaying.setAttribute('aria-hidden', 'true');
      return;
    }

    const animation = menuNowPlaying.animate([
      {transform:'translateX(0)', opacity:1},
      {transform:'translateX(calc(100% + 32px))', opacity:0}
    ], {duration:NOW_PLAYING_ANIMATION_MS, easing:'ease-in', fill:'both'});

    nowPlayingAnimation = animation;
    animation.onfinish = () => {
      if (nowPlayingAnimation !== animation) return;
      menuNowPlaying.hidden = true;
      menuNowPlaying.setAttribute('aria-hidden', 'true');
      nowPlayingAnimation = null;
    };
  }

  // Reproduce una canción del menú. Con newTrack=true cambia a otra aleatoria
  // (al entrar al menú y cada vez que termina la anterior).
  function playMenuMusic(newTrack = false) {
    if (startScreen.hidden || !storyIntro.hidden) return;

    if (newTrack || !menuTrack) {
      menuTrack = pickRandomMenuTrack();
      menuMusic.src = menuTrack.src;
      menuSongProgressFill.style.width = '0%';
      menuSongProgress.setAttribute('aria-valuenow', '0');
    }

    updateNowPlayingInfo(menuTrack);
    menuMusic.play().then(() => {
      document.removeEventListener('pointerdown', unlockMenuMusic);
      document.removeEventListener('keydown', unlockMenuMusic);
      showNowPlaying(menuTrack);
    }).catch(() => {
      // Si el navegador bloquea el autoplay, el primer gesto del usuario la habilita.
      document.addEventListener('pointerdown', unlockMenuMusic);
      document.addEventListener('keydown', unlockMenuMusic);
    });
  }

  function unlockMenuMusic() {
    // Si ya se salió del menú, no arrancar música encima del juego.
    if (startScreen.hidden || !storyIntro.hidden) {
      document.removeEventListener('pointerdown', unlockMenuMusic);
      document.removeEventListener('keydown', unlockMenuMusic);
      return;
    }
    playMenuMusic();
  }

  // Detiene la música del menú, la regresa al inicio y esconde su barra.
  function stopMenuMusic() {
    menuMusic.pause();
    try { menuMusic.currentTime = 0; } catch (error) {}
    document.removeEventListener('pointerdown', unlockMenuMusic);
    document.removeEventListener('keydown', unlockMenuMusic);
    hideNowPlaying(true);
  }

  /* ==========================================================================
     5. NAVEGACIÓN ENTRE PANELES
     ========================================================================== */

  // Muestra solo el panel indicado y oculta los demás.
  function showOnly(panel) {
    for (const item of panels) {
      item.hidden = item !== panel;
    }

    // La barra musical solo se ve en el menú principal.
    if (panel !== mainMenu) {
        hideNowPlaying(true);
    }

    // El Mimao solo aparece en el menú principal.
    if (panel === mainMenu) {
        menuMimao.hidden = false;
        startMimaoAnimation();
    } else {
        stopMimaoAnimation();
        menuMimao.hidden = true;
    }
}
  // Vuelve al menú principal, cancela la introducción si estaba en marcha y pone otra canción.
  function showMainMenu() {
    storyIntro.hidden = true;
    storyIntro.classList.remove('is-dialogue-comic');
    comicIntroView.hidden = true;
    activeDialogueComic = null;
    activeDialogueOnComplete = null;
    document.body.classList.remove('story-transition');
    startScreen.hidden = false;
    showOnly(mainMenu);
    playMenuMusic(true);
  }

  /* ==========================================================================
     6. MODO HISTORIA
     ========================================================================== */

  function setComicPanel(def, panel) {
    comicPanel.style.setProperty('--panel-ratio', String(panel.width / panel.height));
    comicPanel.style.aspectRatio = `${panel.width} / ${panel.height}`;
    comicPanelArt.style.width = `${def.page.width / panel.width * 100}%`;
    comicPanelArt.style.left = `${-panel.x / panel.width * 100}%`;
    comicPanelArt.style.top = `${-panel.y / panel.height * 100}%`;
    comicArtClip.style.clipPath = panel.clip || 'none';
    comicCutLine.toggleAttribute('hidden', !panel.clip);
  }

  // Pinta la viñeta activa de un cómic por viñetas. Mientras queden diálogos,
  // la viñeta la marca cada entrada; cuando se acaban, avanza a las viñetas
  // restantes sin burbuja.
  function renderDialogueComic(animatePanel = false) {
    const def = activeDialogueComic;
    if (!def) return;
    const entry = def.dialogues[activeDialogueIndex] || null;
    if (entry) activeDialoguePanel = entry.panel;
    const panel = def.panels[activeDialoguePanel];
    if (!panel) return;
    const panelChanged = comicPanel.dataset.panel !== String(activeDialoguePanel);
    if (panelChanged) {
      setComicPanel(def, panel);
      comicPanel.dataset.panel = String(activeDialoguePanel);
    }

    if (entry) {
      const bubble = entry.bubble;
      comicBubble.hidden = false;
      comicSpeaker.textContent = entry.speaker;
      comicDialogue.textContent = entry.text;
      comicBubble.dataset.speaker = entry.speaker;
      comicBubble.style.left = `${bubble.left}%`;
      comicBubble.style.top = `${bubble.top}%`;
      comicBubble.style.width = `${bubble.width}%`;
      comicTail.style.left = `${bubble.tail.x}%`;
      comicTail.style.setProperty('--tail-flip', String(bubble.tail.flip || 1));
      comicDialogueCount.hidden = false;
      comicDialogueCount.textContent = `${String(activeDialogueIndex + 1).padStart(2, '0')} / ${String(def.dialogues.length).padStart(2, '0')}`;
      storyIntro.setAttribute('aria-label', `Cómic: ${entry.speaker}. ${entry.text}`);
    } else {
      comicBubble.hidden = true;
      comicSpeaker.textContent = '';
      comicDialogue.textContent = '';
      comicBubble.removeAttribute('data-speaker');
      comicDialogueCount.hidden = true;
      comicDialogueCount.textContent = '';
      storyIntro.setAttribute('aria-label', `Cómic: viñeta ${activeDialoguePanel + 1} de ${def.panels.length}.`);
    }

    if (animatePanel) {
      if (entry) {
        comicBubble.animate(
          [{opacity:0, transform:'translateY(8px) scale(.97)'},{opacity:1, transform:'translateY(0) scale(1)'}],
          {duration:SCENE_ANIMATION_MS, easing:'ease-out'}
        );
      }
      if (panelChanged) {
        comicPanel.animate(
          [{opacity:.35, transform:'scale(1.012)'},{opacity:1, transform:'scale(1)'}],
          {duration:SCENE_ANIMATION_MS + 80, easing:'ease-out'}
        );
      }
    }
  }

  // Prepara un cómic por viñetas sin mostrarlo todavía. Cada cómic trae su
  // propia página, sus viñetas y sus diálogos; el callback decide qué sigue.
  function beginDialogueComic(def, onComplete) {
    activeDialogueComic = def;
    activeDialogueOnComplete = onComplete || null;
    activeDialogueIndex = 0;
    activeDialoguePanel = def.dialogues[0]?.panel || 0;
    comicPanelArt.src = def.image;
    comicPanelArt.alt = def.alt;
    comicPanel.dataset.panel = '';
    comicBubble.hidden = true;
    comicDialogueCount.hidden = true;
  }

  function finishDialogueComic() {
    const onComplete = activeDialogueOnComplete;
    activeDialogueComic = null;
    activeDialogueOnComplete = null;
    storyIntro.hidden = true;
    comicIntroView.hidden = true;
    storyIntro.classList.remove('is-dialogue-comic');
    comicBubble.hidden = true;
    if (onComplete) onComplete();
  }

  function renderComicPage() {
    const page = comicPages[comicIndex];
    if (!page) return;
    storyIntro.dataset.scene = String(comicIndex % 3);
    storyIntro.style.setProperty('--comic-art', page.image ? `url("${page.image}")` : 'none');
    storyIntro.style.setProperty('--comic-zoom', String(page.zoom || 1));
    storyIntro.style.setProperty('--comic-focus', page.focus || 'center');
    storyPanelNumber.textContent = `${String(comicIndex + 1).padStart(2, '0')} / ${String(comicPages.length).padStart(2, '0')}`;
    storyLabel.textContent = page.label;
    storyTitle.textContent = page.title;
    storyText.textContent = page.text;
    storyIntro.setAttribute('aria-label', `${page.label}. ${page.title}. ${page.text}`);
    storyContinueHint.textContent = comicIndex === comicPages.length - 1
      ? (comicFlow === 'final' ? 'HAZ CLIC PARA VOLVER AL MENÚ' : comicFlow === 'intro' ? 'HAZ CLIC PARA EMPEZAR' : 'HAZ CLIC PARA CONTINUAR')
      : 'HAZ CLIC PARA CONTINUAR';
    storyIntro.animate([{opacity:0, transform:'scale(1.025)'},{opacity:1, transform:'scale(1)'}], {duration:SCENE_ANIMATION_MS, easing:'ease-out'});
  }

  function showComic(pages, flow) {
    comicPages = pages;
    comicIndex = 0;
    comicFlow = flow;
    storyIntro.classList.remove('is-dialogue-comic');
    comicIntroView.hidden = true;
    document.body.classList.remove('story-transition');
    startScreen.hidden = false;
    showOnly(storyIntro);
    renderComicPage();
  }

  function advanceComic() {
    // Los cómics por viñetas avanzan un paso por clic: primero sus diálogos y
    // después las viñetas restantes, que se revelan sin burbuja.
    if (activeDialogueComic) {
      const def = activeDialogueComic;
      if (activeDialogueIndex < def.dialogues.length) {
        const nextIndex = activeDialogueIndex + 1;
        if (nextIndex < def.dialogues.length) {
          activeDialogueIndex = nextIndex;
          renderDialogueComic(true);
          return;
        }
        // Último diálogo mostrado: salta a la viñeta que va después de él.
        const lastPanel = def.dialogues[def.dialogues.length - 1].panel;
        activeDialogueIndex = def.dialogues.length;
        activeDialoguePanel = lastPanel + 1;
        if (activeDialoguePanel >= def.panels.length) {
          finishDialogueComic();
          return;
        }
        renderDialogueComic(true);
        return;
      }
      if (activeDialoguePanel + 1 < def.panels.length) {
        activeDialoguePanel++;
        renderDialogueComic(true);
        return;
      }
      finishDialogueComic();
      return;
    }

    if (comicIndex + 1 < comicPages.length) {
      comicIndex++;
      renderComicPage();
      return;
    }
    storyIntro.hidden = true;
    if (comicFlow === 'final') {
      showMainMenu();
    } else {
      startScreen.hidden = true;
      document.dispatchEvent(new CustomEvent('rhythm:comic:continue'));
    }
  }

  function startStoryIntro() {
    stopMenuMusic();
    document.body.classList.add('story-transition');
    startScreen.hidden = false;
    showOnly(storyIntro);
    comicFlow = 'intro';
    beginDialogueComic(INTRO_COMIC, () => {
      startScreen.hidden = true;
      document.body.classList.remove('practice-mode');
      document.dispatchEvent(new Event('rhythm:start'));
    });
    storyIntro.classList.add('is-dialogue-comic');
    comicIntroView.hidden = false;
    storyIntro.hidden = true;
    window.setTimeout(() => {
      document.body.classList.remove('story-transition');
      storyIntro.hidden = false;
      renderDialogueComic(true);
    }, 500);
  }

  // Cómic 2: se muestra al terminar la Canción 1 y, al acabar, retoma el flujo
  // narrativo que ya existía para el siguiente tramo de la historia.
  function startComic2(onComplete) {
    startScreen.hidden = false;
    showOnly(storyIntro);
    comicFlow = 'comic2';
    beginDialogueComic(COMIC_2, onComplete);
    storyIntro.classList.add('is-dialogue-comic');
    comicIntroView.hidden = false;
    storyIntro.hidden = false;
    // El fundido a negro ya lo hizo game.js al cerrar los resultados.
    document.body.classList.remove('story-transition');
    renderDialogueComic(true);
  }

  /* ==========================================================================
     7. PRÁCTICA
     ========================================================================== */

  // Oculta el menú y avisa al juego para empezar con notas aleatorias.
  function startPractice() {
    stopMenuMusic();
    startScreen.hidden = true;
    document.body.classList.add('practice-mode'); // el CSS oculta la barra de impulso
    document.dispatchEvent(new Event('rhythm:practice'));
  }

  // Sale de la práctica: detiene el juego y vuelve al menú.
  function exitPractice() {
    document.body.classList.remove('practice-mode');
    document.dispatchEvent(new Event('rhythm:stop'));
    showMainMenu();
  }

  /* ==========================================================================
     8. CRÉDITOS, OPCIONES Y LEADERBOARD
     ========================================================================== */

  function openCredits() {
    showOnly(creditsPanel);
  }

  function openLeaderboard() {
    showOnly(leaderboardScreen);
  }

  // Muestra el menú de secciones de opciones y oculta todas las páginas.
  function showOptionsHome() {
    optionsMenu.hidden = false;
    backToOptions.hidden = true;
    optionPages.forEach(page => { page.hidden = true; });
    optionsTitle.textContent = 'OPCIONES';
  }

  // Abre las opciones (siempre en el menú de secciones) y pone el foco en el botón de volver.
  function openSettings() {
    showOptionsHome();
    showOnly(settingsScreen);
    backFromSettings.focus();
  }

  // Abre una sección de opciones (audio, dificultad, canción o controles).
  function openOptionPage(name) {
    const page = OPTION_PAGES[name];
    optionsMenu.hidden = true;
    optionPages.forEach(item => { item.hidden = item.id !== page.id; });
    backToOptions.hidden = false;
    optionsTitle.textContent = page.label;
  }

  /* ==========================================================================
     9. TECLA ESCAPE
     ========================================================================== */

  // Escape retrocede un paso: dentro de una sección de opciones vuelve a las opciones;
  // en opciones, leaderboard o introducción vuelve al menú; en práctica sale al menú.
  function handleEscape(event) {
    if (event.key !== 'Escape') return;

    if (!settingsScreen.hidden) {
      event.preventDefault();
      if (backToOptions.hidden) showMainMenu();
      else showOptionsHome();
      return;
    }

    if (!leaderboardScreen.hidden || !storyIntro.hidden) {
      event.preventDefault();
      showMainMenu();
      return;
    }

    if (document.body.classList.contains('practice-mode')) {
      event.preventDefault();
      exitPractice();
    }
  }

  /* ==========================================================================
     10. EVENTOS Y ARRANQUE
     ========================================================================== */

  function bindEvents() {
    // Botones del menú principal.
    $('#startButton').addEventListener('click', startStoryIntro);
    $('#practiceButton').addEventListener('click', startPractice);
    $('#openLeaderboardButton').addEventListener('click', openLeaderboard);
    $('#creditsButton').addEventListener('click', openCredits);
    $('#openSettingsButton').addEventListener('click', openSettings);

    // Botón de reiniciar: sale de la práctica y vuelve al menú (game.js también reinicia la partida).
    $('#resetButton').addEventListener('click', () => {
      document.body.classList.remove('practice-mode');
      showMainMenu();
    });

    // Secciones de opciones y su botón de volver.
    document.querySelectorAll('[data-option-page]').forEach(button => {
      button.addEventListener('click', () => openOptionPage(button.dataset.optionPage));
    });
    backToOptions.addEventListener('click', showOptionsHome);

    // Cada clic en el cómic avanza exactamente un cuadro.
    storyIntro.addEventListener('click', advanceComic);
    document.addEventListener('rhythm:comic', event => {
      const nextStage = event.detail?.nextStage;
      // Tras la Canción 1 se intercala el Cómic 2 y luego sigue el flujo
      // narrativo que ya existía para el siguiente tramo.
      if (nextStage === 1) {
        startComic2(() => showComic(COMIC_BY_NEXT_STAGE[nextStage] || [], 'between'));
        return;
      }
      document.body.classList.add('story-transition');
      showComic(COMIC_BY_NEXT_STAGE[nextStage] || [], 'between');
    });
    document.addEventListener('rhythm:comic:final', () => {
      document.body.classList.add('story-transition');
      showComic(FINAL_COMIC, 'final');
    });
    document.addEventListener('rhythm:comic:continue', () => document.dispatchEvent(new Event('rhythm:next-stage')));
    $('#backFromCredits').addEventListener('click', showMainMenu);
    backFromSettings.addEventListener('click', showMainMenu);
    $('#backFromLeaderboard').addEventListener('click', showMainMenu);

    // Música del menú: al terminar una canción empieza otra al azar y la barra avanza sola.
    menuMusic.addEventListener('ended', () => {
      if (!startScreen.hidden && storyIntro.hidden) playMenuMusic(true);
    });
    menuMusic.addEventListener('timeupdate', updateNowPlayingProgress);
    menuMusic.addEventListener('loadedmetadata', updateNowPlayingProgress);

    document.addEventListener('keydown', handleEscape);
  }

  // Calcula la escala que hace caber el marco 1920x1080 sin deformarlo.
  // Si la ventana no es 16:9, la diferencia queda como espacio libre centrado.
  function fitGameFrame() {
    const scale = Math.min(
      window.innerWidth / VIEWPORT_WIDTH,
      window.innerHeight / VIEWPORT_HEIGHT
    );
    document.documentElement.style.setProperty('--game-scale', String(scale));
  }

  function init() {
    // Escala proporcional del marco de referencia 1920x1080 (letterboxing).
    fitGameFrame();
    window.addEventListener('resize', fitGameFrame);
    window.addEventListener('orientationchange', fitGameFrame);

    let savedVolume = NaN;
    try {
      const saved = localStorage.getItem(MENU_MUSIC_VOLUME_KEY);
      if (saved !== null) savedVolume = Number(saved);
    } catch (error) {}
    if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 100) {
      menuMusicVolume.value = String(savedVolume);
    }
    menuMusic.volume = Number(menuMusicVolume.value) / 100;
    menuMusicVolumeValue.value = `${menuMusicVolume.value}%`;
    menuMusicVolume.addEventListener('input', event => {
      const value = Number(event.target.value);
      menuMusic.volume = value / 100;
      menuMusicVolumeValue.value = `${value}%`;
      try { localStorage.setItem(MENU_MUSIC_VOLUME_KEY, String(value)); } catch (error) {}
    });
    bindEvents();
    // Empieza durante la intro; si falla por las políticas del navegador, espera interacción.
    playMenuMusic(true);

    // El fondo se quita solo al acabar el fade-out, dejando visible el menú existente.
    gameIntroLogo.addEventListener('animationend', () => {
      gameIntro.hidden = true;
      introFinished = true;
      // La barra aparece recién cuando terminó la intro, nunca durante ella.
      if (menuTrack && !menuMusic.paused) showNowPlaying(menuTrack);
    }, {once:true});
  }

  init();
})();
