// Maneja el menú principal, la introducción de historia, los créditos, las opciones, el leaderboard y la práctica.
(() => {
  'use strict';

  /* ==========================================================================
     1. CONFIGURACIÓN
     ========================================================================== */

  // Escenas de la introducción del modo historia: se muestran una tras otra.
  const STORY_SCENES = [
    {label:'CAPÍTULO 01', title:'¿DÓNDE ESTOY?',          text:'Acabas de despertar en tu habitación pero no se siente igual...'},
    {label:'CAPÍTULO 01', title:'1986!!',                 text:'Ves el calendario y ves que dice 1986, abres la ventana y ves luces de neón y música de Federico Mercurio...'},
    {label:'CAPÍTULO 01', title:'NO TIENES NADA',         text:'Te das cuenta de que no tienes un centavo y decides salir a volverte a ganar el público.'},
    {label:'CAPÍTULO 01', title:'¿LISTO PARA VOLVER?',    text:'Vuelves a cantar pero ahora debes ganarte a cada uno del público.'}
  ];
  const SCENE_DURATION_MS  = 5000; // tiempo que se ve cada escena
  const SCENE_ANIMATION_MS = 500;  // duración de la animación de cambio de escena

  // Texto del botón de la introducción: saltar mientras corre, empezar al llegar a la última escena.
  const SKIP_LABEL  = 'SALTAR INTRO ▶';
  const START_LABEL = 'EMPEZAR CANCIÓN ▶';

  const MENU_MUSIC_VOLUME_KEY = 'ritmo-menu-music-volume';

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
  const skipStoryIntro = $('#skipStoryIntro');

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

  let storyTimer = 0;  // temporizador que avanza a la siguiente escena
  let sceneIndex = 0;  // escena que toca mostrar

  let menuTrack = null;          // canción del menú que suena ahora
  let introFinished = false;     // la barra solo puede aparecer al acabar la intro
  let nowPlayingTimer = 0;       // oculta la barra tras unos segundos
  let nowPlayingAnimation = null; // animación de entrada o salida en curso

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
    for (const item of panels) item.hidden = item !== panel;
    // La barra musical solo se ve en el menú principal.
    if (panel !== mainMenu) hideNowPlaying(true);
  }

  // Vuelve al menú principal, cancela la introducción si estaba en marcha y pone otra canción.
  function showMainMenu() {
    clearTimeout(storyTimer);
    startScreen.hidden = false;
    showOnly(mainMenu);
    playMenuMusic(true);
  }

  /* ==========================================================================
     6. MODO HISTORIA
     ========================================================================== */

  // Cierra la introducción y el menú, y avisa al juego para empezar.
  function beginStoryGame() {
    clearTimeout(storyTimer);
    stopMenuMusic();
    storyIntro.hidden = true;
    startScreen.hidden = true;
    document.body.classList.remove('practice-mode');
    document.dispatchEvent(new Event('rhythm:start'));
  }

  // Muestra la escena actual con una animación; en la última, el botón cambia a "EMPEZAR CANCIÓN".
  function showStoryScene() {
    const scene = STORY_SCENES[sceneIndex];
    storyIntro.dataset.scene = String(sceneIndex); // el CSS cambia el color según la escena
    storyLabel.textContent = scene.label;
    storyTitle.textContent = scene.title;
    storyText.textContent  = scene.text;

    storyIntro.animate([
      {opacity:0, transform:'translateY(10px) scale(.98)'},
      {opacity:1, transform:'translateY(0) scale(1)'}
    ], {duration:SCENE_ANIMATION_MS, easing:'ease-out'});

    sceneIndex++;
    if (sceneIndex < STORY_SCENES.length) {
      storyTimer = setTimeout(showStoryScene, SCENE_DURATION_MS);
    } else {
      // La partida no empieza sola: el clic inicia el audio, como exigen los navegadores.
      skipStoryIntro.textContent = START_LABEL;
    }
  }

  // Empieza la introducción desde la primera escena.
  function startStoryIntro() {
    stopMenuMusic();
    showOnly(storyIntro);
    sceneIndex = 0;
    skipStoryIntro.textContent = SKIP_LABEL;
    showStoryScene();
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

    // Botones para saltar la introducción o volver al menú.
    skipStoryIntro.addEventListener('click', beginStoryGame);
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

  function init() {
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
