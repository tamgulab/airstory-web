export function initDeviceExplorer() {
  const data = {
    pm25:    { title: "PM 2.5 sensor", subtitle: "Plantower", badge: "Air particles", color: "blue",
               what: "The blue metal box. Air flows in one side, gets measured, exits the other. Tap 'Look inside' to see how.",
               how: "A fan pulls air through a chamber. A laser shines across the path. When dust particles cross the beam, they scatter the light — bigger particles scatter more. A photodiode catches the scattered light and turns the brightness into a number." },
    co:      { title: "CO sensor", subtitle: "Electrochemical disc", badge: "Toxic gas", color: "purple",
               what: "The blue disc detects carbon monoxide — odorless, colorless gas from combustion. Gas enters through tiny mesh holes on top.",
               how: "An electrochemical cell reacts with CO molecules and produces a tiny current. Bigger current = more CO." },
    temp:    { title: "Temperature & humidity", subtitle: "Ambient conditions", badge: "Comfort", color: "teal",
               what: "Measures air temperature and moisture through small vent holes on top.",
               how: "Resistance changes with heat; capacitance changes with water vapor. Reported as °C + %RH." },
    battery: { title: "Lithium-ion battery", subtitle: "3.7V · 3000mAh", badge: "Power", color: "green",
               what: "Rechargeable pouch battery — runs the device for a class period or field walk.",
               how: "Lithium ions shuttle between electrodes. Charging pushes them one way, using the device lets them flow back." },
    leds:    { title: "Status LEDs", subtitle: "Four indicators", badge: "Feedback", color: "amber",
               what: "Four white bulbs that tell you what's happening — power, Bluetooth, sensor reading, alert.",
               how: "Each LED is a tiny semiconductor. Current flows through it, electrons release energy as light." },
    usb:     { title: "USB-C & buttons", subtitle: "Power and control", badge: "I/O", color: "coral",
               what: "USB-C charges and talks to a computer. Buttons turn the device on and trigger a manual reading.",
               how: "USB-C carries 5V power and serial data. Buttons are mechanical switches wired to the MCU." },
    ble:     { title: "BLE chip & MCU", subtitle: "Microcontroller", badge: "Brain", color: "pink",
               what: "Reads every sensor, packages the numbers, beams them to a phone over Bluetooth.",
               how: "Firmware loops: poll sensors → average samples → timestamp → send via Bluetooth Low Energy." },
    pcb:     { title: "Circuit board", subtitle: "1.2mm fiberglass", badge: "Skeleton", color: "gray",
               what: "Fiberglass board with copper wiring etched in — physically connects every part.",
               how: "Copper traces carry signals and power between components. Green solder mask protects the copper." },
    case:    { title: "3D printed case", subtitle: "PLA shell", badge: "Body", color: "amber",
               what: "Yellow plastic shell. Printed in the lab so the design can be iterated — students can redesign it.",
               how: "A 3D printer lays melted plastic layer by layer. Each layer fuses to the one below as it cools." }
  };

  // Headline shown in the narrative panel once a part is selected — distinct from
  // the plain part title, which now lives in the hover tooltip instead.
  const storyHeadlines = {
    pm25: "It counts particles with light.",
    co: "It notices a gas you can't see.",
    temp: "It reads the room around it.",
    battery: "It keeps the sensor moving.",
    leds: "It shows what the device is doing.",
    usb: "It connects power and control.",
    ble: "It turns readings into data.",
    pcb: "Everything meets here.",
    case: "The shell was made to change."
  };

  const root           = document.getElementById("abc-root");
  const defaultEl      = document.getElementById("abc-default");
  const detailEl       = document.getElementById("abc-detail");
  const badgeEl        = document.getElementById("abc-badge");
  const titleEl        = document.getElementById("abc-title");
  const whatEl         = document.getElementById("abc-what");
  const howEl          = document.getElementById("abc-how");
  const askBtn         = document.getElementById("abc-askmore");
  const hintEl         = document.getElementById("abc-hint");
  const modePill       = document.getElementById("abc-mode-pill");
  const btnAir         = document.getElementById("abc-btn-air");
  const airDot         = document.getElementById("abc-air-dot");
  const airLabel       = document.getElementById("abc-air-label");
  const viewTop        = document.getElementById("view-top");
  const viewCut        = document.getElementById("view-cut");
  const lookInsideBtn  = document.getElementById("abc-look-inside");
  const backBtn        = document.getElementById("abc-btn-back");
  const airflowTop     = document.getElementById("airflow-top");
  const particlesContainer = document.getElementById("particles-container");
  const cutParticles   = document.getElementById("cut-particles");
  const fanBlades      = document.getElementById("fan-blades");
  const laserBeam      = document.getElementById("laser-beam");
  const laserLineGlow  = document.getElementById("laser-line-glow");
  const laserLineCore  = document.getElementById("laser-line-core");
  const scatterPoint   = document.getElementById("scatter-point");
  const scatterFlash   = document.getElementById("scatter-flash-circle");
  const scatterLine    = document.getElementById("scatter-line");
  const photodiodeGlow = document.getElementById("photodiode-glow");
  const cutLabels      = document.getElementById("cut-labels");

  let currentId    = null;
  let currentView  = "top";
  let airflowOn    = false;
  let animationId  = null;
  let particles    = [];
  let airflowNudgeShown = false;
  let airflowNudgeTimer = null;
  // "What's next" guidance: airflow first, then either the Plantower cutaway or the walk
  // scenario — whichever the visitor tries first. Each nudge fires once per session.
  let plantowerVisited   = false;
  let nextStepNudgeShown = false;
  let nextStepNudgeTimer = null;

  function clearNextStepNudge() {
    if (nextStepNudgeTimer) {
      window.clearTimeout(nextStepNudgeTimer);
      nextStepNudgeTimer = null;
    }
    const pm25Part = root.querySelector('.abc-part[data-id="pm25"]');
    const simCard = document.getElementById("sim-card");
    if (pm25Part) pm25Part.classList.remove("next-step-nudge");
    if (simCard) simCard.classList.remove("next-step-nudge");
  }

  function maybeNudgeNextStep() {
    if (nextStepNudgeShown || plantowerVisited || window.AIRSTORY_SCENARIO_ENGAGED) return;
    nextStepNudgeShown = true;
    nextStepNudgeTimer = window.setTimeout(() => {
      nextStepNudgeTimer = null;
      if (!airflowOn || currentView !== "top" || plantowerVisited || window.AIRSTORY_SCENARIO_ENGAGED) return;
      const pm25Part = root.querySelector('.abc-part[data-id="pm25"]');
      const simCard = document.getElementById("sim-card");
      if (pm25Part) pm25Part.classList.add("next-step-nudge");
      if (simCard) simCard.classList.add("next-step-nudge");
      window.setTimeout(() => {
        if (pm25Part) pm25Part.classList.remove("next-step-nudge");
        if (simCard) simCard.classList.remove("next-step-nudge");
      }, 3900);
    }, 1100);
  }

  const SVG_NS = "http://www.w3.org/2000/svg";

  function show(id) {
    const d = data[id]; if (!d) return;
    currentId = id;
    root.classList.add("has-active");
    root.querySelectorAll(".abc-part").forEach(p => p.classList.toggle("active", p.dataset.id === id));
    defaultEl.style.display = "none";
    detailEl.style.display  = "flex";
    if (hintEl) hintEl.style.display = "none";
    badgeEl.textContent = d.title + (d.subtitle ? " · " + d.subtitle : "");
    badgeEl.removeAttribute("style");
    titleEl.textContent = storyHeadlines[id] || d.title;
    whatEl.textContent = d.what;
    howEl.textContent  = d.how;
    lookInsideBtn.style.display = "none";
    askBtn.textContent = (id === "pm25" && currentView === "top") ? "Look inside →" : "Ask more ↗";
  }

  function clearSelection() {
    if (currentView !== "top") return;
    currentId = null;
    root.classList.remove("has-active");
    root.querySelectorAll(".abc-part").forEach(p => p.classList.remove("active"));
    detailEl.style.display = "none";
    defaultEl.style.display = "flex";
    if (hintEl) hintEl.style.display = "";
    hidePartTip();
  }

  const visualEl = root.querySelector(".abc-visual") || document.getElementById("abc-stage");
  const partTip = document.createElement("div");
  partTip.className = "abc-part-tooltip";
  partTip.setAttribute("role", "status");
  if (visualEl) visualEl.appendChild(partTip);

  function showPartTip(e, id) {
    const d = data[id]; if (!d || currentView !== "top" || !visualEl) return;
    const r = visualEl.getBoundingClientRect();
    partTip.textContent = d.title;
    partTip.style.left = Math.max(70, Math.min(r.width - 70, e.clientX - r.left)) + "px";
    partTip.style.top = Math.max(54, e.clientY - r.top) + "px";
    partTip.classList.add("on");
  }
  function hidePartTip() { partTip.classList.remove("on"); }

  function bindParts() {
    root.querySelectorAll(".abc-part").forEach(p => {
      if (p.dataset.bound) return;
      p.dataset.bound = "1";
      p.style.cursor = "pointer";
      p.addEventListener("mouseenter", e => showPartTip(e, p.dataset.id));
      p.addEventListener("mousemove", e => showPartTip(e, p.dataset.id));
      p.addEventListener("mouseleave", hidePartTip);
      p.addEventListener("click", () => {
        hidePartTip();
        show(p.dataset.id);
      });
      p.setAttribute("tabindex", "0");
      p.setAttribute("role", "button");
      p.addEventListener("focus", () => show(p.dataset.id));
      p.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(p.dataset.id); }
      });
    });
  }

  // Clicking the product stage outside the sensor returns to the clean default view.
  const stageEl = document.getElementById("abc-stage");
  if (stageEl) {
    stageEl.addEventListener("click", e => {
      if (currentView !== "top" || !currentId) return;
      if (e.target.closest(".abc-part, #abc-panel, .abc-controls, #abc-hint, .abc-part-tooltip")) return;
      clearSelection();
    });
  }

  function enterCutaway() {
    currentView = "cut";
    root.classList.add("cutaway-active");
    viewTop.style.display = "none";
    viewCut.style.display = "";
    modePill.textContent = "Inside PM 2.5";
    backBtn.style.display = "";
    lookInsideBtn.style.display = "none";
    updateAirflow();

    // Plantower has been found — the "look inside or try the walk" nudge no longer applies.
    plantowerVisited = true;
    clearNextStepNudge();

    // One gentle nudge per page load: after entering Plantower, point out airflow once.
    if (!airflowNudgeShown && !airflowOn && btnAir) {
      airflowNudgeShown = true;
      window.setTimeout(() => {
        if (currentView !== "cut" || airflowOn) return;
        btnAir.classList.add("airflow-nudge");
        airflowNudgeTimer = window.setTimeout(() => {
          btnAir.classList.remove("airflow-nudge");
          airflowNudgeTimer = null;
        }, 3900);
      }, 650);
    }
  }

  function exitCutaway() {
    currentView = "top";
    root.classList.remove("cutaway-active");
    viewTop.style.display = "";
    viewCut.style.display = "none";
    modePill.textContent = "Top view";
    backBtn.style.display = "none";
    lookInsideBtn.style.display = "none";
    if (currentId === "pm25") askBtn.textContent = "Look inside →";
    updateAirflow();
  }

  function setAirflow(on) {
    airflowOn = on;
    if (btnAir) btnAir.classList.remove("airflow-nudge");
    if (airflowNudgeTimer) {
      window.clearTimeout(airflowNudgeTimer);
      airflowNudgeTimer = null;
    }
    if (on) {
      root.classList.add("airflow-on");
      airDot.style.background = "#34c759";
      airLabel.textContent = "Hide airflow";
    } else {
      root.classList.remove("airflow-on");
      airDot.style.background = "#c7c7cc";
      airLabel.textContent = "Show airflow";
    }
    updateAirflow();
    document.dispatchEvent(new CustomEvent('airstory:airflow', { detail: { on: airflowOn, view: currentView } }));

    // Airflow just turned on with nothing else tried yet — point at the next step
    // (Plantower or the walk scenario). Airflow always comes first, so this only ever
    // fires once it's actually on.
    if (airflowOn) maybeNudgeNextStep();
    else clearNextStepNudge();
  }

  function updateAirflow() {
    if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
    particles.forEach(p => p.el.remove());
    particles = [];
    airflowTop.style.display = "none";
    fanBlades.classList.remove("spinning");
    laserBeam.style.display = "none";
    laserBeam.classList.remove("on");
    cutLabels.style.display = "none";
    scatterPoint.style.display = "none";
    photodiodeGlow.setAttribute("opacity", 0);
    // Reset beam to full length
    laserLineGlow.setAttribute("x2", BEAM.x2);
    laserLineGlow.setAttribute("y2", BEAM.y2);
    laserLineCore.setAttribute("x2", BEAM.x2);
    laserLineCore.setAttribute("y2", BEAM.y2);

    if (!airflowOn) return;
    if (currentView === "top") {
      airflowTop.style.display = "";
      animateTopView();
    } else if (currentView === "cut") {
      cutLabels.style.display = "";
      laserBeam.style.display = "";
      laserBeam.classList.add("on");
      fanBlades.classList.add("spinning");
      animateCutaway();
    }
  }

  function spawnTopParticle() {
    const isCO = Math.random() < 0.3;
    const el = document.createElementNS(SVG_NS, "circle");
    if (isCO) {
      el.setAttribute("r", 1.8);
      el.setAttribute("fill", "#a64fb8");
      el.setAttribute("opacity", "0.85");
    } else {
      const dirty = Math.random() < 0.4;
      el.setAttribute("r", dirty ? 2.2 : 1.6);
      el.setAttribute("fill", dirty ? "#8a5a3a" : "#3a8fb8");
      el.setAttribute("opacity", dirty ? "0.9" : "0.7");
    }
    particlesContainer.appendChild(el);
    let path;
    if (isCO) {
      const startX = 340 + Math.random() * 50;
      path = { type: "co", x: startX, y: 360, targetX: 367, targetY: 245, progress: 0, speed: 0.012 + Math.random() * 0.008 };
    } else {
      const yOffset = 210 + Math.random() * 35;
      path = { type: "pm", baseY: yOffset, progress: 0, speed: 0.006 + Math.random() * 0.004, dirty: el.getAttribute("fill") === "#8a5a3a" };
    }
    particles.push({ el, path });
  }

  function updateTopParticles() {
    particles = particles.filter(p => {
      p.path.progress += p.path.speed;
      let x, y, opacity = 1;
      if (p.path.type === "co") {
        const t = p.path.progress;
        x = p.path.x + (p.path.targetX - p.path.x) * t;
        y = p.path.y + (p.path.targetY - p.path.y) * t;
        if (t > 0.85) opacity = (1 - t) / 0.15;
        if (t >= 1) { p.el.remove(); return false; }
      } else {
        const t = p.path.progress;
        if (t < 0.15) { x = 65 + (133 - 65) * (t / 0.15); y = p.path.baseY; }
        else if (t < 0.4) { x = 133 + (160 - 133) * ((t - 0.15) / 0.25); y = p.path.baseY; }
        else if (t < 0.7) {
          const ct = (t - 0.4) / 0.3;
          x = 160 + (275 - 160) * ct;
          y = p.path.baseY + Math.sin(ct * Math.PI * 4) * 3;
        }
        else if (t < 0.9) { x = 275 + (305 - 275) * ((t - 0.7) / 0.2); y = p.path.baseY; }
        else { x = 305 + (455 - 305) * ((t - 0.9) / 0.1); y = p.path.baseY; opacity = (1 - t) / 0.1; }
        if (t >= 1) { p.el.remove(); return false; }
      }
      p.el.setAttribute("cx", x);
      p.el.setAttribute("cy", y);
      p.el.setAttribute("opacity", opacity * 0.85);
      return true;
    });
  }

  let lastSpawn = 0;
  function animateTopView(ts) {
    if (!airflowOn || currentView !== "top") return;
    if (!ts) ts = performance.now();
    if (ts - lastSpawn > Math.max(90, (window.AIRSTORY_RATE || 180) * 0.65) && particles.length < 25) {
      spawnTopParticle();
      lastSpawn = ts;
    }
    updateTopParticles();
    animationId = requestAnimationFrame(animateTopView);
  }

  function spawnCutParticle() {
    // Three categories with clear teaching purpose:
    //   clean: blue, small, no scatter (just air molecules — passes through)
    //   small dirty: tan, ~PM2.5 fine (~2.5μm), small scatter
    //   large dirty: tan, ~PM10 (~10μm), big scatter
    const r = Math.random();
    const MIX = window.AIRSTORY_MIX || { clean: 0.35, small: 0.75 };
    let kind, particleR, fill;
    if (r < MIX.clean) {
      kind = "clean"; particleR = 1.4; fill = "#7ab8d8";
    } else if (r < MIX.small) {
      kind = "smallDirty"; particleR = 2.2; fill = "#c8966a";
    } else {
      kind = "largeDirty"; particleR = 3.6; fill = "#a06840";
    }
    const el = document.createElementNS(SVG_NS, "circle");
    el.setAttribute("r", particleR);
    el.setAttribute("fill", fill);
    el.setAttribute("opacity", "0.85");
    cutParticles.appendChild(el);
    const yBase = 195 + Math.random() * 50;
    particles.push({
      el,
      path: {
        type: "cut", progress: 0,
        speed: (0.004 + Math.random() * 0.003) * (window.AIRSTORY_SPEED || 1),
        yBase, kind, particleR,
        triggeredScatter: false
      }
    });
  }

  // Laser beam endpoints (kept in sync with SVG)
  const BEAM = { x1: 180, y1: 139, x2: 280, y2: 315 };

  // Distance from a point to the beam line segment, plus parametric t (0..1) along segment
  function beamProximity(px, py) {
    const dx = BEAM.x2 - BEAM.x1, dy = BEAM.y2 - BEAM.y1;
    const len2 = dx*dx + dy*dy;
    let t = ((px - BEAM.x1) * dx + (py - BEAM.y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = BEAM.x1 + t * dx, cy = BEAM.y1 + t * dy;
    const ddx = px - cx, ddy = py - cy;
    return { dist: Math.sqrt(ddx*ddx + ddy*ddy), t, cx, cy };
  }

  function updateCutParticles() {
    let activeBeamCutT = 1;       // 1 = full beam visible, 0 = fully cut at source
    let activeScatter = null;     // { x, y, intensity } — strongest scatter this frame

    particles = particles.filter(p => {
      p.path.progress += p.path.speed;
      const t = p.path.progress;
      let x, y;
      if (t < 0.08) { x = 60 + (90 - 60) * (t / 0.08); y = p.path.yBase; }
      else if (t < 0.85) {
        const ct = (t - 0.08) / 0.77;
        x = 90 + (370 - 90) * ct;
        y = p.path.yBase + Math.sin(ct * Math.PI * 5) * 4;
      }
      else { x = 370 + (460 - 370) * ((t - 0.85) / 0.15); y = p.path.yBase; }

      let opacity = 0.85;
      if (t > 0.92) opacity = (1 - t) / 0.08;
      if (t >= 1) { p.el.remove(); return false; }
      p.el.setAttribute("cx", x);
      p.el.setAttribute("cy", y);
      p.el.setAttribute("opacity", opacity);

      // Beam interaction: check if particle is touching beam line
      // Threshold = particle radius + small buffer
      const prox = beamProximity(x, y);
      const touching = prox.dist <= p.path.particleR + 1.5;
      if (touching) {
        // Cut beam at this t (closer to source = more cutoff)
        if (prox.t < activeBeamCutT) activeBeamCutT = prox.t;
        // Only dirty particles scatter — clean (air) just passes through
        if (p.path.kind !== "clean") {
          // Intensity scales with particle size
          const intensity = p.path.kind === "largeDirty" ? 1.0 : 0.45;
          if (!activeScatter || intensity > activeScatter.intensity) {
            activeScatter = { x: prox.cx, y: prox.cy, intensity };
          }
        }
      }
      return true;
    });

    // Apply beam cutoff
    if (activeBeamCutT < 1) {
      const cutX = BEAM.x1 + activeBeamCutT * (BEAM.x2 - BEAM.x1);
      const cutY = BEAM.y1 + activeBeamCutT * (BEAM.y2 - BEAM.y1);
      laserLineGlow.setAttribute("x2", cutX);
      laserLineGlow.setAttribute("y2", cutY);
      laserLineCore.setAttribute("x2", cutX);
      laserLineCore.setAttribute("y2", cutY);
    } else {
      laserLineGlow.setAttribute("x2", BEAM.x2);
      laserLineGlow.setAttribute("y2", BEAM.y2);
      laserLineCore.setAttribute("x2", BEAM.x2);
      laserLineCore.setAttribute("y2", BEAM.y2);
    }

    // Apply scatter effect proportional to intensity
    if (activeScatter) {
      const i = activeScatter.intensity;
      scatterPoint.style.display = "";
      // Flash radius scales with intensity (small particle = small flash)
      scatterFlash.setAttribute("cx", activeScatter.x);
      scatterFlash.setAttribute("cy", activeScatter.y);
      scatterFlash.setAttribute("r", 5 + i * 12);
      scatterFlash.setAttribute("opacity", 0.4 + i * 0.5);
      // Scatter line from impact point to photodiode
      scatterLine.setAttribute("x1", activeScatter.x);
      scatterLine.setAttribute("y1", activeScatter.y);
      scatterLine.setAttribute("stroke-width", 0.8 + i * 1.5);
      scatterLine.setAttribute("opacity", 0.4 + i * 0.5);
      // Photodiode reacts: brighter for bigger particles
      photodiodeGlow.setAttribute("opacity", 0.3 + i * 0.55);
    } else {
      scatterPoint.style.display = "none";
      photodiodeGlow.setAttribute("opacity", 0);
    }
  }

  let lastCutSpawn = 0;
  function animateCutaway(ts) {
    if (!airflowOn || currentView !== "cut") return;
    if (!ts) ts = performance.now();
    if (ts - lastCutSpawn > (window.AIRSTORY_RATE || 280) && particles.length < (window.AIRSTORY_CAP || 12)) {
      spawnCutParticle();
      lastCutSpawn = ts;
    }
    updateCutParticles();
    animationId = requestAnimationFrame(animateCutaway);
  }

  btnAir.addEventListener("click", () => setAirflow(!airflowOn));
  lookInsideBtn.addEventListener("click", enterCutaway);
  backBtn.addEventListener("click", exitCutaway);

  bindParts();

  askBtn.addEventListener("click", () => {
    if (!currentId) return;
    if (currentId === "pm25" && currentView === "top") {
      enterCutaway();
      return;
    }
    const d = data[currentId];
    const question = "Tell me more about the " + d.title + " in the AirStory device — how does it actually work, and what could students explore with it?";
    // In standalone mode, dispatch a custom event for any host integration.
    // Hosts can listen with: document.addEventListener('airstory:askmore', e => { ... e.detail.question ... })
    const evt = new CustomEvent('airstory:askmore', { detail: { partId: currentId, part: d, question: question } });
    document.dispatchEvent(evt);
    // Also fall back to copying the question to clipboard for now.
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(question).then(() => {
        const orig = askBtn.textContent;
        askBtn.textContent = "Copied to clipboard ✓";
        setTimeout(() => { askBtn.textContent = orig; }, 1500);
      }).catch(() => {});
    }
  });
}

/**
 * "Take the sensor for a walk" — a self-contained progressive-disclosure card.
 * Airflow must be turned on (via the sensor's own control) before the walk
 * unlocks; selecting a stop drives the same window.AIRSTORY_* globals the
 * cutaway particle animation already reads, so the story and diagram can
 * never disagree with each other.
 */
export function initSensorWalk() {
  const STOPS = [
    { name: 'City park', v: 8,
      note: 'Roughly the daily PM 2.5 a New Yorker breathes above ground on an ordinary day.',
      src: 'Source: NYU study coverage, 2021 · 7.7 µg/m³ baseline daily exposure',
      mix: { clean: 0.88, small: 0.97 }, rate: 330, cap: 8, speed: 0.75 },
    { name: 'Your classroom', v: 12,
      note: "Your own PHG01 average — the one number here that came off your students' sensors.",
      src: 'Source: your imported data, period 1, 34 readings',
      mix: { clean: 0.72, small: 0.92 }, rate: 265, cap: 11, speed: 0.9 },
    { name: 'Aboveground station', v: 29,
      note: 'Open-air platforms sit well below the underground ones — the air can actually leave.',
      src: 'Source: Environment International, NYC subway survey, 2023 · 29 ± 20 µg/m³',
      mix: { clean: 0.45, small: 0.80 }, rate: 185, cap: 15, speed: 1.15 },
    { name: 'Inside a train car', v: 88,
      note: 'Cabin filtration helps, but the car is still pulling tunnel air as it moves.',
      src: 'Source: Environment International, NYC subway survey, 2023 · 88 ± 14 µg/m³',
      mix: { clean: 0.15, small: 0.55 }, rate: 112, cap: 22, speed: 1.5 },
    { name: 'Underground platform', v: 142,
      note: 'About 43% of this mass is iron — steel dust ground off wheels and brakes with nowhere to go.',
      src: 'Source: Environment International, NYC subway survey, 2023 · 142 ± 69 µg/m³',
      mix: { clean: 0.05, small: 0.38 }, rate: 68, cap: 30, speed: 1.9 }
  ];
  const MAXV = 142;
  const BANDS = [
    [12, 'Good', '--good'],
    [35, 'Moderate', '--mod'],
    [55, 'Sensitive groups', '--usg'],
    [150, 'Unhealthy', '--unh'],
    [250, 'Very unhealthy', '--vunh'],
    [1e9, 'Hazardous', '--haz']
  ];
  function band(v) {
    for (let i = 0; i < BANDS.length; i++) { if (v <= BANDS[i][0]) return BANDS[i]; }
    return BANDS[BANDS.length - 1];
  }

  const stopsEl = document.getElementById('sim-stops');
  const playBtn = document.getElementById('sim-play');
  const simCard = document.getElementById('sim-card');
  const simStory = document.getElementById('sim-story');
  const startBtn = document.getElementById('sim-start');
  if (!stopsEl || !playBtn || !simCard) return;

  // Lets the main sensor controller know the visitor has actually engaged the walk
  // (not just that airflow auto-revealed the gate), so it stops nudging toward it.
  function markScenarioEngaged() {
    if (window.AIRSTORY_SCENARIO_ENGAGED) return;
    window.AIRSTORY_SCENARIO_ENGAGED = true;
    const pm25Part = document.querySelector('.abc-part[data-id="pm25"]');
    if (pm25Part) pm25Part.classList.remove('next-step-nudge');
    if (simCard) simCard.classList.remove('next-step-nudge');
  }

  let scenarioUnlocked = false;
  function unlockScenario() {
    if (scenarioUnlocked) return;
    scenarioUnlocked = true;
    simCard.classList.add('is-ready');
    if (simStory) simStory.setAttribute('aria-hidden', 'false');
    // The first place becomes the starting point only once airflow is meaningful.
    select(0);
  }

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      // Reuse the sensor's actual airflow control so the story and diagram can never diverge.
      const airButton = document.getElementById('abc-btn-air');
      const sensorRoot = document.getElementById('abc-root');
      if (sensorRoot && !sensorRoot.classList.contains('airflow-on') && airButton) airButton.click();
      else unlockScenario();
    });
  }

  document.addEventListener('airstory:airflow', e => {
    if (e.detail && e.detail.on) unlockScenario();
  });

  const buttons = Array.prototype.slice.call(stopsEl.querySelectorAll('button'));
  buttons.forEach((b, i) => {
    const s = STOPS[i];
    const bd = band(s.v);
    const fill = b.querySelector('.s-bar i');
    fill.style.background = 'var(' + bd[2] + ')';
    fill.style.width = (s.v / MAXV * 100) + '%';
    const detail = b.querySelector('.stop-detail-inner');
    detail.innerHTML =
      '<span class="stop-reading"><strong>' + s.v + '</strong><span class="unit">µg/m³</span>' +
      '<span class="stop-status"><span class="dot" style="background:var(' + bd[2] + ')"></span>' + bd[1] + '</span></span>' +
      '<span class="stop-note">' + s.note + '</span>' +
      '<span class="stop-src">' + s.src + '</span>';
  });

  let index = -1;
  let playing = null;

  function select(i) {
    if (i === index) return;
    index = i;
    const s = STOPS[i];
    buttons.forEach((b, j) => b.classList.toggle('on', j === i));

    // drive the diagram
    window.AIRSTORY_MIX = s.mix;
    window.AIRSTORY_RATE = s.rate;
    window.AIRSTORY_CAP = s.cap;
    window.AIRSTORY_SPEED = s.speed;
  }

  stopsEl.addEventListener('click', e => {
    if (!scenarioUnlocked) return;
    const b = e.target.closest('button');
    if (!b) return;
    markScenarioEngaged();
    if (playing) { clearInterval(playing); playing = null; playBtn.textContent = 'Play the whole walk'; }
    select(parseInt(b.dataset.i, 10));
  });

  playBtn.addEventListener('click', () => {
    if (!scenarioUnlocked) return;
    markScenarioEngaged();
    if (playing) {
      clearInterval(playing);
      playing = null;
      playBtn.textContent = 'Play the whole walk';
      return;
    }

    // Playing the walk always means the sensor is actively sampling air.
    // This also makes the top-view airflow visible when the user has left
    // the Plantower cutaway or previously turned airflow off.
    const airButton = document.getElementById('abc-btn-air');
    const sensorRoot = document.getElementById('abc-root');
    if (sensorRoot && !sensorRoot.classList.contains('airflow-on') && airButton) {
      airButton.click();
    }

    let i = 0;
    select(0);
    playBtn.textContent = 'Stop';
    playing = setInterval(() => {
      i++;
      if (i >= STOPS.length) {
        clearInterval(playing);
        playing = null;
        playBtn.textContent = 'Play the whole walk';
        return;
      }
      select(i);
    }, 2600);
  });
}
