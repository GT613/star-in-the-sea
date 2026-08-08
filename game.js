(() => {
  const data = window.STORY_DATA.stories;
  const $ = (id) => document.getElementById(id);
  const screens = ["home", "game", "ending"];
  let state = { role: null, scene: 0, routes: [], speed: 18 };
  let typing = null;
  const music = {
    enabled: localStorage.getItem("galaxy8:music") !== "off",
    volume: Number(localStorage.getItem("galaxy8:volume") || 42) / 100,
    active: 0,
    key: "",
    players: [new Audio(), new Audio()]
  };
  music.players.forEach(player => { player.loop = true; player.preload = "auto"; player.volume = 0; });

  // A restrained eight-track score. Each character receives three broad acts,
  // so music changes with the arc instead of with every dialogue screen.
  const musicLibrary = {
    menu: ["Future-Goth.mp3"],
    伍尔夫: ["Midnight-Mist.mp3", "Too-Quiet_Looping.mp3", "Aftermath.mp3"],
    图兰: ["Future-Goth.mp3", "Captain-Badass-2.mp3", "After-the-Invasion_Looping.mp3"],
    林静姝: ["Midnight-Fog.mp3", "Quiet-Tension_Looping.mp3", "Aftermath.mp3"],
    林静恒: ["Quiet-Tension_Looping.mp3", "Captain-Badass-2.mp3", "After-the-Invasion_Looping.mp3"],
    陆必行: ["Future-Goth.mp3", "Midnight-Mist.mp3", "After-the-Invasion_Looping.mp3"],
    ending: ["Aftermath.mp3"]
  };

  function soundtrackFor(route, sceneIndex) {
    const progress = sceneIndex / Math.max(1, route.scenes.length - 1);
    const act = progress < 0.38 ? 0 : progress < 0.76 ? 1 : 2;
    return { file: musicLibrary[route.id][act], key: `${route.id}:act-${act + 1}` };
  }

  function fade(player, from, to, duration, stopAfter = false) {
    const started = performance.now();
    function frame(now) {
      const p = Math.min(1, (now - started) / duration);
      player.volume = Math.max(0, Math.min(1, from + (to - from) * p));
      if (p < 1) requestAnimationFrame(frame); else if (stopAfter) { player.pause(); player.currentTime = 0; }
    }
    requestAnimationFrame(frame);
  }

  function playMusic(kind, seed = kind, force = false, directFile = "") {
    const list = musicLibrary[kind] || musicLibrary.menu;
    const file = directFile || list[0];
    const key = directFile ? seed : `${kind}:${file}`;
    if (!music.enabled || (!force && music.key === key)) return;
    const oldPlayer = music.players[music.active];
    const nextIndex = 1 - music.active;
    const nextPlayer = music.players[nextIndex];
    nextPlayer.src = encodeURI(`背景音乐/${file}`);
    nextPlayer.currentTime = 0;
    nextPlayer.volume = 0;
    const attempt = nextPlayer.play();
    if (attempt) attempt.then(() => {
      fade(oldPlayer, oldPlayer.volume, 0, 900, true);
      fade(nextPlayer, 0, music.volume, 1100);
      music.active = nextIndex; music.key = key;
    }).catch(() => {});
  }

  function updateMusicButton() {
    $("toggle-audio").querySelector("span").textContent = music.enabled ? "已开启" : "已静音";
  }

  function show(id) { screens.forEach(x => $(x).classList.toggle("active", x === id)); }
  function save() { if (state.role) localStorage.setItem(`galaxy8:${state.role}`, JSON.stringify(state)); }
  function load(role) { try { return JSON.parse(localStorage.getItem(`galaxy8:${role}`)); } catch { return null; } }
  function story() { return data.find(x => x.id === state.role); }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

  function renderRoles() {
    $("role-list").innerHTML = data.map((role) => {
      const progress = load(role.id);
      const pct = progress ? Math.min(100, Math.round(progress.scene / role.scenes.length * 100)) : 0;
      return `<button class="role-card" data-role="${role.id}" style="--accent:${role.accent}"><img src="${encodeURI(role.portrait)}" alt="${role.name}"><span class="role-info"><strong>${role.name}</strong><span>${role.subtitle}</span><small>${pct ? pct + "%" : "新篇"}</small></span></button>`;
    }).join("");
    document.querySelectorAll(".role-card").forEach(btn => btn.onclick = () => start(btn.dataset.role));
  }

  function start(role) {
    state = load(role) || { role, scene: 0, routes: [], speed: Number($("speed").value) };
    state.role = role;
    show("game"); renderScene();
  }

  function typeText(lines) {
    clearInterval(typing);
    const target = $("story-text"), full = lines.join("\n");
    let i = 0; target.textContent = "";
    typing = setInterval(() => { target.textContent = full.slice(0, ++i); if (i >= full.length) clearInterval(typing); }, Math.max(8, 48 - state.speed));
    target.onclick = () => { clearInterval(typing); target.textContent = full; };
  }

  function renderScene() {
    const route = story(), scene = route.scenes[state.scene];
    if (!scene) return complete();
    document.documentElement.style.setProperty("--accent", route.accent);
    $("route-name").textContent = `${route.name} · ${route.subtitle}`;
    $("chapter-name").textContent = scene.chapter;
    $("speaker").textContent = route.name;
    $("portrait").src = encodeURI(route.portrait); $("portrait").alt = route.name;
    $("backdrop").style.backgroundImage = `url("${encodeURI(scene.background)}")`;
    $("progress-bar").style.width = `${(state.scene + 1) / route.scenes.length * 100}%`;
    const score = soundtrackFor(route, state.scene);
    playMusic("menu", score.key, false, score.file);
    typeText(scene.text);
    const pluginButton = $("open-plugin");
    pluginButton.hidden = !scene.plugin;
    if (scene.plugin) $("plugin-trigger-title").textContent = scene.plugin.title;
    $("choices").innerHTML = scene.choices.map(c => `<button class="choice" data-key="${c.key}">${esc(c.title)}</button>`).join("");
    const choiceButtons = [...document.querySelectorAll(".choice")];
    $("next").style.display = choiceButtons.length ? "none" : "block";
    choiceButtons.forEach(btn => btn.onclick = () => {
      choiceButtons.forEach(x => x.disabled = true); btn.classList.add("selected");
      state.routes.push(btn.textContent.trim()); save(); $("next").style.display = "block";
    });
    save();
  }

  function complete() {
    const route = story();
    show("ending"); $("ending-title").textContent = `${route.name}主线完成`;
    $("ending-copy").textContent = `你已走完「${route.subtitle}」的全部剧情。星海保存了你的每一次选择。`;
    $("route-record").innerHTML = [...new Set(state.routes)].map(x => `<span>${esc(x)}</span>`).join("") || "<span>命运航线已记录</span>";
    localStorage.setItem(`galaxy8:complete:${route.id}`, "1");
    playMusic("ending", route.id, true);
  }

  $("next").onclick = () => { clearInterval(typing); state.scene++; save(); renderScene(); };
  function openStoryPlugin() {
    const scene = story().scenes[state.scene];
    if (!scene || !scene.plugin) return;
    $("plugin-label").textContent = scene.plugin.label;
    $("plugin-title").textContent = scene.plugin.title;
    $("plugin-content").textContent = scene.plugin.content.join("\n\n");
    $("story-plugin").classList.add("open");
    $("story-plugin").setAttribute("aria-hidden", "false");
  }
  function closeStoryPlugin() {
    $("story-plugin").classList.remove("open");
    $("story-plugin").setAttribute("aria-hidden", "true");
  }
  $("open-plugin").onclick = openStoryPlugin;
  $("close-plugin").onclick = closeStoryPlugin;
  $("finish-plugin").onclick = closeStoryPlugin;
  $("story-plugin").onclick = event => { if (event.target === $("story-plugin")) closeStoryPlugin(); };
  $("back-home").onclick = () => { save(); show("home"); renderRoles(); playMusic("menu", "home", true); };
  $("ending-home").onclick = () => { show("home"); renderRoles(); playMusic("menu", "home", true); };
  $("open-menu").onclick = () => { $("menu").classList.add("open"); $("menu").setAttribute("aria-hidden", "false"); };
  $("close-menu").onclick = () => { $("menu").classList.remove("open"); $("menu").setAttribute("aria-hidden", "true"); };
  $("speed").oninput = e => { state.speed = Number(e.target.value); save(); };
  $("toggle-audio").onclick = () => {
    music.enabled = !music.enabled; localStorage.setItem("galaxy8:music", music.enabled ? "on" : "off");
    updateMusicButton();
    if (!music.enabled) music.players.forEach(player => fade(player, player.volume, 0, 350, true));
    else if (state.role && $("game").classList.contains("active")) { music.key = ""; renderScene(); }
    else playMusic("menu", "home", true);
  };
  $("volume").value = Math.round(music.volume * 100);
  $("volume").oninput = e => {
    music.volume = Number(e.target.value) / 100; localStorage.setItem("galaxy8:volume", String(e.target.value));
    if (music.enabled) music.players[music.active].volume = music.volume;
  };
  $("restart").onclick = () => { if (confirm("确定重新开始这条主线吗？")) { localStorage.removeItem(`galaxy8:${state.role}`); start(state.role); $("menu").classList.remove("open"); } };
  updateMusicButton();
  document.addEventListener("pointerdown", () => { if (music.enabled && !music.key) playMusic("menu", "home", true); }, { once: true });
  renderRoles();
})();
