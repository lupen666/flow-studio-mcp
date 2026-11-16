(() => {
  if (typeof LIVE === "undefined" || !LIVE) return;

  const tabsNav = document.getElementById("tabs");
  const mainEl = document.querySelector(".cols main");
  if (!tabsNav || !mainEl) return;

  const NEW_TABS = [
    { id: "locations", label: "Locations", sub: "environments" },
    { id: "avatars", label: "Avatars", sub: "multi-angle" },
    { id: "director", label: "Director", sub: "prompt studio" },
    { id: "proedit", label: "Pro Edit", sub: "xfade & grade" },
    { id: "vertical", label: "Vertical", sub: "9:16 export" },
    { id: "inspector", label: "Inspector", sub: "UI & selectors" },
  ];

  for (const t of NEW_TABS) {
    const btn = document.createElement("button");
    btn.dataset.tab = t.id;
    btn.innerHTML = `${esc(t.label)}<small>${esc(t.sub)}</small>`;
    tabsNav.appendChild(btn);
  }

  const panelsHtml = `
    <!-- LOCATIONS -->
    <section class="panel" data-panel="locations">
      <div class="step">Library</div>
      <h2>Locations</h2>
      <p class="lede">Save reusable environments with lighting, palette, lens, and up to 3 reference images so every scene stays visually consistent.</p>
      <div class="card">
        <div id="locList" class="rowbtns" style="margin-bottom:12px"></div>
        <div class="grid2">
          <div><label class="f">Name</label><input type="text" id="locName" placeholder="Rainy Neon Alley"></div>
          <div><label class="f">ID (optional slug)</label><input type="text" id="locId" placeholder="auto-generated"></div>
        </div>
        <label class="f">Environment description</label>
        <textarea id="locDesc" style="min-height:80px" placeholder="Narrow cobblestone alley with wet pavement reflections, brick walls, steam vents"></textarea>
        <div class="grid2">
          <div><label class="f">Lighting</label><input type="text" id="locLight" placeholder="Warm practicals + cool cyan rim"></div>
          <div><label class="f">Time of day</label><input type="text" id="locTime" placeholder="Night / Golden hour"></div>
        </div>
        <div class="grid2">
          <div><label class="f">Weather</label><input type="text" id="locWeather" placeholder="Light rain, mist"></div>
          <div><label class="f">Color palette</label><input type="text" id="locPalette" placeholder="Teal, amber, deep charcoal"></div>
        </div>
        <div class="grid2">
          <div><label class="f">Camera lens</label><input type="text" id="locLens" placeholder="35mm anamorphic, f/2.0"></div>
          <div><label class="f">Ambient audio</label><input type="text" id="locAudio" placeholder="Soft rain patter, distant traffic"></div>
        </div>
        <label class="f">Reference images (comma-separated paths or asset:title, max 3)</label>
        <input type="text" id="locRefs" placeholder="/path/to/ref1.png, asset:alley_keyframe">
        <label class="f">Avoid / negative notes</label>
        <input type="text" id="locNeg" placeholder="modern billboards, crowds">
        <div class="rowbtns">
          <button class="btn" id="locSaveBtn">Save location</button>
          <button class="btn ghost small" id="locReloadBtn">Reload</button>
          <button class="btn ghost small" id="locDelBtn">Delete selected</button>
        </div>
        <p class="empty" id="locInfo" style="margin-top:10px"></p>
      </div>
    </section>

    <!-- AVATARS -->
    <section class="panel" data-panel="avatars">
      <div class="step">Library</div>
      <h2>Avatars</h2>
      <p class="lede">Store multi-angle persona packets (front, 3/4, profile, close-up, full body). The Director picks up to 3 matching angles automatically.</p>
      <div class="card">
        <div id="avList" class="rowbtns" style="margin-bottom:12px"></div>
        <div class="grid2">
          <div><label class="f">Name</label><input type="text" id="avName" placeholder="Lead Detective"></div>
          <div><label class="f">ID (optional slug)</label><input type="text" id="avId" placeholder="auto-generated"></div>
        </div>
        <label class="f">Fixed subject description</label>
        <textarea id="avDesc" style="min-height:80px" placeholder="32-year-old woman, short dark wavy hair, sharp amber eyes, subtle scar on left eyebrow"></textarea>
        <div class="grid2">
          <div><label class="f">Outfit lock</label><input type="text" id="avOutfit" placeholder="Charcoal wool trench coat over black turtleneck"></div>
          <div><label class="f">Voice notes (optional)</label><input type="text" id="avVoice" placeholder="Calm, measured alto"></div>
        </div>
        <div class="grid2">
          <div><label class="f">Front ref</label><input type="text" id="avFront" placeholder="/path/front.png or asset:..."></div>
          <div><label class="f">3/4 angle ref</label><input type="text" id="avThreeQ" placeholder="/path/34.png or asset:..."></div>
        </div>
        <div class="grid2">
          <div><label class="f">Profile ref</label><input type="text" id="avProfile" placeholder="/path/profile.png"></div>
          <div><label class="f">Close-up ref</label><input type="text" id="avClose" placeholder="/path/closeup.png"></div>
        </div>
        <div class="grid2">
          <div><label class="f">Full body ref</label><input type="text" id="avFull" placeholder="/path/full.png"></div>
          <div><label class="f">Negative notes</label><input type="text" id="avNeg" placeholder="sunglasses, hat"></div>
        </div>
        <div class="rowbtns">
          <button class="btn" id="avSaveBtn">Save avatar</button>
          <button class="btn ghost small" id="avReloadBtn">Reload</button>
          <button class="btn ghost small" id="avDelBtn">Delete selected</button>
        </div>
        <p class="empty" id="avInfo" style="margin-top:10px"></p>
      </div>
    </section>

    <!-- DIRECTOR -->
    <section class="panel" data-panel="director">
      <div class="step">Prompt Studio</div>
      <h2>Prompt Director</h2>
      <p class="lede">Combine saved Avatars, Locations, Styles, and Camera Techniques into a continuity-safe Flow/Veo prompt (0 credits to compose).</p>
      <div class="card">
        <div class="grid2">
          <div><label class="f">Output type</label><select id="dirType"><option value="video">Video</option><option value="image">Image (0 credits)</option></select></div>
          <div><label class="f">Aspect ratio</label><select id="dirAspect"><option value="16:9">16:9</option><option value="9:16">9:16</option><option value="1:1">1:1</option><option value="4:3">4:3</option><option value="3:4">3:4</option></select></div>
        </div>
        <div class="grid2">
          <div><label class="f">Avatar</label><select id="dirAvatar"><option value="">-- none --</option></select></div>
          <div><label class="f">Location</label><select id="dirLocation"><option value="">-- none --</option></select></div>
        </div>
        <div class="grid2">
          <div><label class="f">Camera technique</label><select id="dirTech"><option value="">-- none --</option></select></div>
          <div><label class="f">Continuity mode</label><select id="dirCont"><option value="standalone">Standalone</option><option value="ingredients">Ingredients (refs)</option><option value="chain_previous">Chain previous</option><option value="first_last_frame">First + Last frame</option></select></div>
        </div>
        <div class="grid2">
          <div><label class="f">Model</label><select id="dirModel"><option value="Omni 1.1 Flash">Omni 1.1 Flash</option><option value="Veo 3.1 - Lite">Veo 3.1 - Lite</option><option value="Veo 3.1 - Fast">Veo 3.1 - Fast</option><option value="Veo 3.1 - Quality">Veo 3.1 - Quality</option><option value="Nano Banana">Nano Banana (Image)</option></select></div>
          <div><label class="f">Duration (sec)</label><select id="dirDur"><option value="4">4s</option><option value="6">6s</option><option value="8" selected>8s</option><option value="10">10s</option></select></div>
        </div>
        <label class="f">Subject override / extra characters (optional)</label>
        <input type="text" id="dirSubject" placeholder="Optional extra subject details">
        <label class="f">Scene action (describe one clear continuous action)</label>
        <textarea id="dirAction" style="min-height:80px" placeholder="0.0-3.0s: steps under the streetlamp and opens the brass pocket watch; 3.0-8.0s: looks up toward the camera as rain begins"></textarea>
        <div class="grid2">
          <div><label class="f">Ambient audio (optional)</label><input type="text" id="dirAudio" placeholder="Soft rain, distant footsteps"></div>
          <div><label class="f">Extra instructions</label><input type="text" id="dirExtra" placeholder="35mm film grain, natural skin texture"></div>
        </div>
        <div class="rowbtns">
          <button class="btn" id="dirComposeBtn">Compose prompt (0 credits)</button>
          <button class="btn ghost" id="dirQueueBtn" disabled>Queue in Flow</button>
        </div>
        <div id="dirPreviewBox" style="margin-top:14px;display:none">
          <label class="f">Compiled prompt (editable before queueing)</label>
          <textarea id="dirCompiledPrompt" style="min-height:95px"></textarea>
          <p class="empty" id="dirMetaInfo" style="margin-top:8px"></p>
        </div>
      </div>
    </section>

    <!-- PRO EDIT -->
    <section class="panel" data-panel="proedit">
      <div class="step">Post-Production</div>
      <h2>Pro Edit (Smooth Transitions &amp; Color)</h2>
      <p class="lede">Join clips with smooth xfade video transitions, acrossfade audio, rhythmic trims, color grading, and EBU R128 loudness normalization.</p>
      <div class="card">
        <div class="grid2">
          <div><label class="f">Project folder</label><input type="text" id="peProject" value="pro-edit"></div>
          <div><label class="f">Output filename (without .mp4)</label><input type="text" id="peOutName" value="final_pro"></div>
        </div>
        <label class="f">Clip paths (one per line, or path|from|to|transition)</label>
        <textarea id="peClips" style="min-height:110px" placeholder="/path/to/scene-01.mp4|0.2|8.5|dissolve"></textarea>
        <div class="grid2">
          <div>
            <label class="f">Default transition</label>
            <select id="peTrans"><option value="dissolve">dissolve</option><option value="smoothup">smoothup</option><option value="smoothdown">smoothdown</option><option value="smoothleft">smoothleft</option><option value="smoothright">smoothright</option><option value="hlwind">hlwind</option><option value="hrwind">hrwind</option><option value="hblur">hblur</option><option value="zoomin">zoomin</option><option value="fade">fade</option><option value="fadeblack">fadeblack</option><option value="fadewhite">fadewhite</option><option value="wipeleft">wipeleft</option><option value="wiperight">wiperight</option><option value="circleopen">circleopen</option><option value="circlecrop">circlecrop</option><option value="radial">radial</option></select>
          </div>
          <div><label class="f">Transition duration (sec)</label><input type="number" id="peTransDur" value="0.7" min="0.15" max="2.5" step="0.1"></div>
        </div>
        <div class="grid2">
          <div>
            <label class="f">Color grade</label>
            <select id="peGrade"><option value="warm-cinema">warm-cinema</option><option value="golden-dream">golden-dream</option><option value="pastel-soft">pastel-soft</option><option value="none">none</option></select>
          </div>
          <div><label class="f">Music path (optional .mp3/.wav)</label><input type="text" id="peMusic" placeholder="/path/to/music.mp3"></div>
        </div>
        <div class="grid2">
          <div><label class="f">Opening fade (sec)</label><input type="number" id="peStartFade" value="0.7" min="0" max="5" step="0.1"></div>
          <div><label class="f">Closing fade (sec)</label><input type="number" id="peEndFade" value="1.2" min="0" max="5" step="0.1"></div>
        </div>
        <label class="f" style="display:flex;align-items:center;gap:8px;margin-top:8px"><input type="checkbox" id="peCta" style="width:auto"> Add animated Like / Comment / Subscribe end card</label>
        <div class="rowbtns"><button class="btn" id="peRunBtn">Render Pro Edit MP4</button></div>
        <div id="peResult" style="margin-top:12px"></div>
      </div>
    </section>

    <!-- VERTICAL -->
    <section class="panel" data-panel="vertical">
      <div class="step">Post-Production</div>
      <h2>Vertical 9:16 &amp; Safe-Zone</h2>
      <p class="lede">Convert any 16:9 video to 9:16 vertical format with FFmpeg and inspect platform safe-zones before rendering.</p>
      <div class="card">
        <label class="f">Input video path</label>
        <input type="text" id="vertInput" placeholder="/path/to/video.mp4">
        <div class="grid2">
          <div><label class="f">Framing mode</label><select id="vertMode"><option value="blur-fill">Blur-fill background</option><option value="center-crop">Center / pan crop</option></select></div>
          <div><label class="f">Horizontal pan (-1 to 1, crop mode)</label><input type="number" id="vertPan" value="0" min="-1" max="1" step="0.1"></div>
        </div>
        <div class="grid2">
          <div><label class="f">Blur strength (5-60)</label><input type="number" id="vertBlur" value="24" min="5" max="60"></div>
          <div><label class="f">Preview timestamp (sec)</label><input type="number" id="vertTime" value="0.5" min="0" step="0.5"></div>
        </div>
        <div class="rowbtns">
          <button class="btn ghost" id="vertPreviewBtn">Render safe-zone preview</button>
          <button class="btn" id="vertExportBtn">Export 9:16 MP4</button>
        </div>
        <div id="vertResult" style="margin-top:12px"></div>
      </div>
    </section>

    <!-- INSPECTOR -->
    <section class="panel" data-panel="inspector">
      <div class="step">Self-Healing UI</div>
      <h2>UI Inspector &amp; Selectors</h2>
      <p class="lede">Inspect the live Flow page, discover new models/options, and override or add UI selectors without editing source code.</p>
      <div class="card">
        <div class="grid2">
          <div><label class="f">Filter DOM elements</label><input type="text" id="inspQuery" placeholder="Generate, Veo, Download, Add..."></div>
          <div style="display:flex;align-items:flex-end;gap:8px">
            <button class="btn" id="inspScanBtn">Inspect live Flow tab</button>
            <button class="btn ghost" id="inspDiscoverBtn">Discover options</button>
          </div>
        </div>
        <div id="inspShotWrap" style="margin-top:12px;display:none">
          <img id="inspShotImg" style="max-width:100%;border-radius:8px;border:1px solid var(--line)">
        </div>
        <div id="inspDomList" style="margin-top:12px;max-height:260px;overflow:auto"></div>
      </div>

      <div class="card" style="margin-top:14px">
        <h3>Selector Overrides &amp; Live Tester</h3>
        <div class="grid2">
          <div><label class="f">Slot name (built-in or custom)</label><input type="text" id="selSlot" placeholder="model_dropdown"></div>
          <div><label class="f">Playwright / CSS selector</label><input type="text" id="selCss" placeholder='button[aria-label*="model" i]'></div>
        </div>
        <label class="f">Note (optional)</label>
        <input type="text" id="selNote" placeholder="Updated selector after Flow UI change">
        <div class="rowbtns">
          <button class="btn" id="selSaveBtn">Save override</button>
          <button class="btn ghost" id="selTestBtn">Test &amp; highlight in Chrome</button>
          <button class="btn ghost small" id="selDelBtn">Reset override</button>
          <button class="btn ghost small" id="selReloadBtn">Refresh list</button>
        </div>
        <p class="empty" id="selTestResult" style="margin-top:10px"></p>
        <div id="selSlotsList" style="margin-top:10px"></div>
      </div>

      <div class="card" style="margin-top:14px">
        <h3>Add Custom Model / Option &amp; UI Macros</h3>
        <div class="grid2">
          <div>
            <label class="f">Category</label>
            <select id="catKey"><option value="models">models</option><option value="aspectRatios">aspectRatios</option><option value="durations">durations</option><option value="resolutions">resolutions</option></select>
          </div>
          <div><label class="f">Value</label><input type="text" id="catVal" placeholder="Veo 3.2 - Ultra"></div>
        </div>
        <div class="rowbtns"><button class="btn ghost" id="catAddBtn">Add to catalog.json</button></div>
        <p class="empty" id="catInfo" style="margin-top:8px"></p>
      </div>
    </section>
  `;

  mainEl.insertAdjacentHTML("beforeend", panelsHtml);

  let LOCATIONS = [];
  let AVATARS = [];
  let LAST_COMPOSED = null;

  const val = (id) => document.getElementById(id)?.value?.trim() ?? "";
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ""; };

  async function refreshLibrary() {
    try {
      const [locRes, avRes] = await Promise.all([api("flow_locations", {}), api("flow_avatars", {})]);
      LOCATIONS = locRes.locations ?? [];
      AVATARS = avRes.avatars ?? [];
      renderLocations();
      renderAvatars();
      renderDirectorSelects();
    } catch {}
  }

  function renderLocations() {
    const host = document.getElementById("locList");
    if (!host) return;
    host.innerHTML = LOCATIONS.length
      ? LOCATIONS.map((l) => `<button type="button" class="btn ghost small" data-load-loc="${esc(l.id)}">${esc(l.name)}</button>`).join("")
      : `<span class="empty">No locations saved yet.</span>`;
  }

  function renderAvatars() {
    const host = document.getElementById("avList");
    if (!host) return;
    host.innerHTML = AVATARS.length
      ? AVATARS.map((a) => `<button type="button" class="btn ghost small" data-load-av="${esc(a.id)}">${esc(a.name)}</button>`).join("")
      : `<span class="empty">No avatars saved yet.</span>`;
  }

  function renderDirectorSelects() {
    const avSel = document.getElementById("dirAvatar");
    const locSel = document.getElementById("dirLocation");
    const techSel = document.getElementById("dirTech");
    if (avSel) avSel.innerHTML = `<option value="">-- none --</option>` + AVATARS.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("");
    if (locSel) locSel.innerHTML = `<option value="">-- none --</option>` + LOCATIONS.map((l) => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join("");
    if (techSel && Array.isArray(TECH) && techSel.options.length <= 1) {
      techSel.innerHTML = `<option value="">-- none --</option>` + TECH.map((t) => `<option value="${esc(t.id)}">${esc(t.category)}: ${esc(t.name)}</option>`).join("");
    }
  }

  document.addEventListener("click", (e) => {
    const lb = e.target.closest("[data-load-loc]");
    if (lb) {
      const l = LOCATIONS.find((x) => x.id === lb.dataset.loadLoc);
      if (l) {
        setVal("locId", l.id); setVal("locName", l.name); setVal("locDesc", l.description);
        setVal("locLight", l.lighting); setVal("locTime", l.timeOfDay); setVal("locWeather", l.weather);
        setVal("locPalette", l.colorPalette); setVal("locLens", l.cameraLens); setVal("locAudio", l.ambientAudio);
        setVal("locRefs", (l.referenceImages ?? []).join(", ")); setVal("locNeg", l.negativeNotes);
      }
    }
    const ab = e.target.closest("[data-load-av]");
    if (ab) {
      const a = AVATARS.find((x) => x.id === ab.dataset.loadAv);
      if (a) {
        setVal("avId", a.id); setVal("avName", a.name); setVal("avDesc", a.subjectDescription);
        setVal("avOutfit", a.outfitLock); setVal("avVoice", a.voiceNotes); setVal("avNeg", a.negativeNotes);
        setVal("avFront", a.angles?.front); setVal("avThreeQ", a.angles?.threeQuarter);
        setVal("avProfile", a.angles?.profile); setVal("avClose", a.angles?.closeup); setVal("avFull", a.angles?.fullBody);
      }
    }
    const pickEl = e.target.closest("[data-pick-sel]");
    if (pickEl) {
      setVal("selCss", pickEl.dataset.pickSel);
      document.getElementById("selTestResult").textContent = `Copied selector into form: ${pickEl.dataset.pickSel}`;
    }
  });

  // Locations handlers
  document.getElementById("locSaveBtn").onclick = async () => {
    const info = document.getElementById("locInfo");
    try {
      const refs = val("locRefs").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3);
      const saved = await api("flow_location_create", {
        ...(val("locId") ? { id: val("locId") } : {}),
        name: val("locName"), description: val("locDesc"),
        lighting: val("locLight") || undefined, timeOfDay: val("locTime") || undefined,
        weather: val("locWeather") || undefined, colorPalette: val("locPalette") || undefined,
        cameraLens: val("locLens") || undefined, ambientAudio: val("locAudio") || undefined,
        negativeNotes: val("locNeg") || undefined, referenceImages: refs,
      });
      info.textContent = `Saved location "${saved.name}" (${saved.id}).`;
      await refreshLibrary();
    } catch (err) { info.textContent = `Error: ${err.message}`; }
  };
  document.getElementById("locReloadBtn").onclick = refreshLibrary;
  document.getElementById("locDelBtn").onclick = async () => {
    const id = val("locId") || val("locName");
    if (!id) return;
    await api("flow_location_delete", { id });
    document.getElementById("locInfo").textContent = `Deleted "${id}".`;
    await refreshLibrary();
  };

  // Avatars handlers
  document.getElementById("avSaveBtn").onclick = async () => {
    const info = document.getElementById("avInfo");
    try {
      const angles = {};
      if (val("avFront")) angles.front = val("avFront");
      if (val("avThreeQ")) angles.threeQuarter = val("avThreeQ");
      if (val("avProfile")) angles.profile = val("avProfile");
      if (val("avClose")) angles.closeup = val("avClose");
      if (val("avFull")) angles.fullBody = val("avFull");
      const saved = await api("flow_avatar_create", {
        ...(val("avId") ? { id: val("avId") } : {}),
        name: val("avName"), subjectDescription: val("avDesc"),
        outfitLock: val("avOutfit") || undefined, voiceNotes: val("avVoice") || undefined,
        negativeNotes: val("avNeg") || undefined, angles,
      });
      info.textContent = `Saved avatar "${saved.name}" (${saved.id}).`;
      await refreshLibrary();
    } catch (err) { info.textContent = `Error: ${err.message}`; }
  };
  document.getElementById("avReloadBtn").onclick = refreshLibrary;
  document.getElementById("avDelBtn").onclick = async () => {
    const id = val("avId") || val("avName");
    if (!id) return;
    await api("flow_avatar_delete", { id });
    document.getElementById("avInfo").textContent = `Deleted "${id}".`;
    await refreshLibrary();
  };

  // Director handlers
  document.getElementById("dirComposeBtn").onclick = async () => {
    try {
      renderDirectorSelects();
      const res = await api("flow_prompt_compose", {
        type: val("dirType"),
        aspectRatio: val("dirAspect"),
        avatarId: val("dirAvatar") || undefined,
        locationId: val("dirLocation") || undefined,
        techniqueId: val("dirTech") || undefined,
        continuityMode: val("dirCont"),
        model: val("dirModel"),
        durationSeconds: Number(val("dirDur")) || 8,
        subject: val("dirSubject") || undefined,
        action: val("dirAction") || undefined,
        ambientAudio: val("dirAudio") || undefined,
        extraInstructions: val("dirExtra") || undefined,
      });
      LAST_COMPOSED = res;
      document.getElementById("dirPreviewBox").style.display = "block";
      setVal("dirCompiledPrompt", res.prompt);
      const warn = res.warnings?.length ? ` | Warnings: ${res.warnings.join(" ; ")}` : "";
      document.getElementById("dirMetaInfo").textContent =
        `Estimated credits: ${res.estimated_credits} | Refs (${res.reference_images.length}/3): ${res.reference_images.join(", ") || "none"}${warn}`;
      document.getElementById("dirQueueBtn").disabled = false;
    } catch (err) {
      document.getElementById("dirPreviewBox").style.display = "block";
      document.getElementById("dirMetaInfo").textContent = `Error: ${err.message}`;
    }
  };

  document.getElementById("dirQueueBtn").onclick = async () => {
    if (!LAST_COMPOSED) return;
    const info = document.getElementById("dirMetaInfo");
    try {
      const scene = { ...LAST_COMPOSED.ready_scene, prompt: val("dirCompiledPrompt") };
      const res = await api("generate", { project: "director", scenes: [scene] });
      info.textContent = `Queued! Job IDs: ${(res.jobs ?? []).map((j) => j.id).join(", ")}`;
    } catch (err) { info.textContent = `Queue error: ${err.message}`; }
  };

  // Pro Edit handler
  document.getElementById("peRunBtn").onclick = async () => {
    const host = document.getElementById("peResult");
    host.innerHTML = `<span class="empty">Rendering Pro Edit MP4...</span>`;
    try {
      const clips = val("peClips").split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
        const [path, from, to, transition] = line.split("|").map((s) => s.trim());
        return {
          path,
          ...(from ? { from: Number(from) } : {}),
          ...(to ? { to: Number(to) } : {}),
          ...(transition ? { transition } : {}),
        };
      });
      const res = await api("flow_pro_edit", {
        project: val("peProject") || "pro-edit",
        outputName: val("peOutName") || "final_pro",
        clips,
        defaultTransition: val("peTrans"),
        defaultTransitionDuration: Number(val("peTransDur")) || 0.7,
        grade: val("peGrade"),
        startFade: Number(val("peStartFade")),
        endFade: Number(val("peEndFade")),
        ...(document.getElementById("peCta")?.checked ? { ctaOverlay: { duration: 3.2 } } : {}),
        ...(val("peMusic") ? { musicPath: val("peMusic") } : {}),
      });
      host.innerHTML = `<p class="empty">Saved (${res.duration}s): <b>${esc(res.outputPath)}</b></p><video controls src="${media(res.outputPath)}" style="max-height:360px;border-radius:8px"></video>`;
    } catch (err) { host.innerHTML = `<span class="empty">Error: ${esc(err.message)}</span>`; }
  };

  // Vertical handlers
  document.getElementById("vertPreviewBtn").onclick = async () => {
    const host = document.getElementById("vertResult");
    host.innerHTML = `<span class="empty">Rendering preview...</span>`;
    try {
      const res = await api("flow_vertical_export", {
        inputPath: val("vertInput"), mode: val("vertMode"),
        panX: Number(val("vertPan")) || 0, blurStrength: Number(val("vertBlur")) || 24,
        timestampSec: Number(val("vertTime")) || 0.5, previewOnly: true, safeZoneGuides: true,
      });
      host.innerHTML = `<img src="${media(res.previewPath)}&t=${Date.now()}" style="max-height:420px;border-radius:8px;border:1px solid var(--line)">`;
    } catch (err) { host.innerHTML = `<span class="empty">Error: ${esc(err.message)}</span>`; }
  };

  document.getElementById("vertExportBtn").onclick = async () => {
    const host = document.getElementById("vertResult");
    host.innerHTML = `<span class="empty">Exporting 9:16 video...</span>`;
    try {
      const res = await api("flow_vertical_export", {
        inputPath: val("vertInput"), mode: val("vertMode"),
        panX: Number(val("vertPan")) || 0, blurStrength: Number(val("vertBlur")) || 24,
        previewOnly: false,
      });
      host.innerHTML = `<p class="empty">Saved: <b>${esc(res.outputPath)}</b></p><video controls src="${media(res.outputPath)}" style="max-height:420px;border-radius:8px"></video>`;
    } catch (err) { host.innerHTML = `<span class="empty">Error: ${esc(err.message)}</span>`; }
  };

  // Inspector handlers
  async function refreshSelectors() {
    try {
      const data = await api("flow_selectors", {});
      const host = document.getElementById("selSlotsList");
      host.innerHTML = (data.slots ?? [])
        .map((s) => `<div style="padding:6px 0;border-bottom:1px solid var(--line)"><b>${esc(s.slot)}</b> <small>${esc(s.description)}</small><br><code>${esc(s.override ?? s.primary)}</code> ${s.override ? '<span class="tag">override</span>' : ""}</div>`)
        .join("");
    } catch {}
  }

  document.getElementById("inspScanBtn").onclick = async () => {
    const domHost = document.getElementById("inspDomList");
    domHost.innerHTML = `<span class="empty">Scanning live Flow tab...</span>`;
    try {
      const res = await api("flow_inspect", { query: val("inspQuery") || undefined, limit: 150 });
      if (res.screenshotPath) {
        document.getElementById("inspShotWrap").style.display = "block";
        document.getElementById("inspShotImg").src = `${media(res.screenshotPath)}&t=${Date.now()}`;
      }
      domHost.innerHTML = (res.elements ?? [])
        .map((el) => `<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid var(--line);font-size:12px"><div><b>${esc(el.tag)}</b> ${el.role ? `[${esc(el.role)}]` : ""} ${esc(el.text || el.ariaLabel || el.placeholder || "")}<br><code>${esc(el.cssSelector)}</code></div><button class="btn ghost small" data-pick-sel="${esc(el.cssSelector)}">Use</button></div>`)
        .join("") || `<span class="empty">No matching elements.</span>`;
    } catch (err) { domHost.innerHTML = `<span class="empty">Error: ${esc(err.message)}</span>`; }
  };

  document.getElementById("inspDiscoverBtn").onclick = async () => {
    const out = document.getElementById("selTestResult");
    try {
      const res = await api("flow_discover_options", {});
      out.textContent = `Models: ${(res.models ?? []).join(", ")} | Ratios: ${(res.aspectRatios ?? []).join(", ")}`;
    } catch (err) { out.textContent = `Error: ${err.message}`; }
  };

  document.getElementById("selSaveBtn").onclick = async () => {
    const out = document.getElementById("selTestResult");
    try {
      await api("flow_selector_save", { slot: val("selSlot"), selector: val("selCss"), note: val("selNote") || undefined });
      out.textContent = `Saved selector override for "${val("selSlot")}".`;
      await refreshSelectors();
    } catch (err) { out.textContent = `Error: ${err.message}`; }
  };

  document.getElementById("selTestBtn").onclick = async () => {
    const out = document.getElementById("selTestResult");
    try {
      const target = val("selCss") || val("selSlot");
      const res = await api("flow_selector_test", { slotOrSelector: target });
      out.textContent = res.ok
        ? `PASS (${res.count} match) via ${res.matchedBy} -> ${res.sample?.tag} "${res.sample?.text ?? ""}"`
        : `FAIL (0 matches) for ${res.matchedBy}`;
    } catch (err) { out.textContent = `Error: ${err.message}`; }
  };

  document.getElementById("selDelBtn").onclick = async () => {
    if (!val("selSlot")) return;
    await api("flow_selector_delete", { slot: val("selSlot") });
    document.getElementById("selTestResult").textContent = `Reset override for "${val("selSlot")}".`;
    await refreshSelectors();
  };
  document.getElementById("selReloadBtn").onclick = refreshSelectors;

  document.getElementById("catAddBtn").onclick = async () => {
    const info = document.getElementById("catInfo");
    try {
      const res = await api("flow_catalog_add", { category: val("catKey"), value: val("catVal") });
      info.textContent = `Updated ${val("catKey")}: ${(res[val("catKey")] ?? []).join(", ")}`;
    } catch (err) { info.textContent = `Error: ${err.message}`; }
  };

  refreshLibrary();
  refreshSelectors();
})();
