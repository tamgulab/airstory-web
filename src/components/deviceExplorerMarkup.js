// Auto-extracted from the design mockup's interactive sensor SVG.
// Kept as a raw markup string (not hand-authored JSX) to preserve exact
// fidelity of ~300 lines of SVG paths/gradients without transcription risk.
const deviceExplorerMarkup = `
<div id="abc-root">
  <div id="abc-grid" class="sensor-cols">
  <div id="abc-stage">
    <div class="abc-visual">
        <div class="abc-controls">
          <div class="abc-controls-left">
            <button id="abc-btn-back" type="button" style="display:none;">← Back</button>
            <div id="abc-mode-pill">Top view</div>
          </div>
          <button id="abc-btn-air" type="button">
            <span id="abc-air-dot"></span>
            <span id="abc-air-label">Show airflow</span>
          </button>
        </div>
        <svg id="abc-svg" viewBox="0 0 520 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="AirStory sensor device interactive diagram">
          
          <desc>An interactive diagram of the AirStory air quality sensor showing all internal components.</desc>

          <defs>
            <pattern id="pcb-solder" width="4" height="4" patternUnits="userSpaceOnUse">
              <rect width="4" height="4" fill="#1a5436"/>
              <circle cx="2" cy="2" r="0.25" fill="#2a7a50" opacity="0.5"/>
            </pattern>
            <pattern id="pcb-traces" width="14" height="14" patternUnits="userSpaceOnUse">
              <path d="M0 7 L14 7 M7 0 L7 14" stroke="#d4a017" stroke-width="0.12" opacity="0.25"/>
            </pattern>
            <linearGradient id="plantower-metal" x1="0%" y1="0%" x2="100%" y2="40%">
              <stop offset="0%" stop-color="#b8dcec"/>
              <stop offset="50%" stop-color="#86c5db"/>
              <stop offset="100%" stop-color="#5fa8c0"/>
            </linearGradient>
            <pattern id="brushed" width="1" height="3" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="3" stroke="#6db5cb" stroke-width="0.25" opacity="0.35"/>
            </pattern>
            <radialGradient id="co-disc" cx="40%" cy="35%" r="70%">
              <stop offset="0%" stop-color="#7d94d4"/>
              <stop offset="60%" stop-color="#4a5fa8"/>
              <stop offset="100%" stop-color="#2a3a7a"/>
            </radialGradient>
            <linearGradient id="case-yellow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#f2d35a"/>
              <stop offset="100%" stop-color="#d4a520"/>
            </linearGradient>
            <radialGradient id="led-white">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
              <stop offset="55%" stop-color="#f8f8fa" stop-opacity="1"/>
              <stop offset="100%" stop-color="#c8c8d0" stop-opacity="1"/>
            </radialGradient>
            <radialGradient id="led-halo">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
              <stop offset="40%" stop-color="#ffffe0" stop-opacity="0.45"/>
              <stop offset="100%" stop-color="#ffffe0" stop-opacity="0"/>
            </radialGradient>
            <radialGradient id="laser-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#ff3030" stop-opacity="0.9"/>
              <stop offset="60%" stop-color="#ff3030" stop-opacity="0.3"/>
              <stop offset="100%" stop-color="#ff3030" stop-opacity="0"/>
            </radialGradient>
            <clipPath id="device-clip">
              <rect x="60" y="50" width="400" height="300" rx="22"/>
            </clipPath>
            <marker id="abc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M2 1 L8 5 L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </marker>
          </defs>

          <!-- ============ TOP VIEW ============ -->
          <g id="view-top">
            <ellipse cx="260" cy="365" rx="190" ry="12" fill="#000" opacity="0.08"/>

            <!-- Yellow case -->
            <g class="abc-part" data-id="case">
              <rect class="glow-target" x="60" y="50" width="400" height="300" rx="22" fill="url(#case-yellow)" stroke="#a88820" stroke-width="0.5"/>
              <rect x="68" y="58" width="384" height="284" rx="16" fill="none" stroke="#8a6810" stroke-width="0.5" opacity="0.3"/>
              <g stroke="#b8901a" stroke-width="0.25" opacity="0.2">
                <line x1="65" y1="80" x2="455" y2="80"/>
                <line x1="65" y1="320" x2="455" y2="320"/>
              </g>
              <rect x="55" y="160" width="8" height="40" rx="2" fill="#8a6810" opacity="0.4"/>
              <rect x="457" y="160" width="8" height="40" rx="2" fill="#8a6810" opacity="0.4"/>
            </g>

            <!-- PCB -->
            <g class="abc-part" data-id="pcb">
              <rect class="glow-target" x="85" y="75" width="350" height="250" rx="6" fill="url(#pcb-solder)" stroke="#0a3020" stroke-width="0.5"/>
              <rect x="85" y="75" width="350" height="250" rx="6" fill="url(#pcb-traces)" pointer-events="none"/>
              <circle cx="100" cy="90" r="3.5" fill="#d4a017" stroke="#8a6810" stroke-width="0.4"/>
              <circle cx="420" cy="90" r="3.5" fill="#d4a017" stroke="#8a6810" stroke-width="0.4"/>
              <circle cx="100" cy="310" r="3.5" fill="#d4a017" stroke="#8a6810" stroke-width="0.4"/>
              <circle cx="420" cy="310" r="3.5" fill="#d4a017" stroke="#8a6810" stroke-width="0.4"/>
              <text x="320" y="160" fill="#9fd8b8" font-size="6" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" opacity="0.6">AirStory V1.0</text>
              <g fill="#2a2a2a" opacity="0.65">
                <rect x="200" y="115" width="4" height="2"/>
                <rect x="208" y="115" width="4" height="2"/>
                <rect x="216" y="115" width="4" height="2"/>
                <rect x="260" y="115" width="4" height="2"/>
                <rect x="110" y="130" width="3" height="5"/>
              </g>
              <rect x="180" y="100" width="18" height="10" rx="1.5" fill="#f5f5f5" stroke="#888" stroke-width="0.3"/>
              <rect x="182" y="102" width="6" height="6" fill="#cc2a2a"/>
              <rect x="190" y="102" width="6" height="6" fill="#222"/>
            </g>

            <!-- LEDs -->
            <g class="abc-part" data-id="leds">
              <g class="glow-target">
                <circle cx="320" cy="100" r="18" fill="url(#led-halo)" class="led-halo"/>
                <circle cx="345" cy="100" r="18" fill="url(#led-halo)" class="led-halo"/>
                <circle cx="370" cy="100" r="18" fill="url(#led-halo)" class="led-halo"/>
                <circle cx="395" cy="100" r="18" fill="url(#led-halo)" class="led-halo"/>
                <circle cx="320" cy="100" r="8" fill="url(#led-white)" stroke="#a8a8b0" stroke-width="0.4"/>
                <circle cx="345" cy="100" r="8" fill="url(#led-white)" stroke="#a8a8b0" stroke-width="0.4"/>
                <circle cx="370" cy="100" r="8" fill="url(#led-white)" stroke="#a8a8b0" stroke-width="0.4"/>
                <circle cx="395" cy="100" r="8" fill="url(#led-white)" stroke="#a8a8b0" stroke-width="0.4"/>
                <circle cx="320" cy="100" r="3" fill="#ffffff"/>
                <circle cx="345" cy="100" r="3" fill="#ffffff"/>
                <circle cx="370" cy="100" r="3" fill="#ffffff"/>
                <circle cx="395" cy="100" r="3" fill="#ffffff"/>
              </g>
            </g>

            <!-- USB-C & buttons -->
            <g class="abc-part" data-id="usb">
              <g class="glow-target">
                <rect x="82" y="135" width="18" height="12" rx="2.5" fill="#cccccf" stroke="#6e6e73" stroke-width="0.4"/>
                <rect x="84" y="137" width="14" height="8" rx="2" fill="#1c1c1e"/>
                <rect x="86" y="139" width="10" height="4" rx="0.8" fill="#3a3a3c"/>
                <circle cx="93" cy="170" r="5" fill="#d1d1d6" stroke="#6e6e73" stroke-width="0.4"/>
                <circle cx="93" cy="170" r="3" fill="#1c1c1e"/>
                <rect x="85" y="195" width="16" height="8" rx="2" fill="#e5e5ea" stroke="#6e6e73" stroke-width="0.4"/>
                <rect x="92" y="196" width="6" height="6" rx="1" fill="#6e6e73"/>
              </g>
            </g>

            <!-- Battery connector -->
            <g class="abc-part" data-id="battery">
              <g class="glow-target">
                <rect x="175" y="96" width="28" height="18" rx="2.5" fill="#fafafa" stroke="#888" stroke-width="0.4"/>
                <rect x="178" y="99" width="22" height="12" rx="1.5" fill="#e0e0e0"/>
                <path d="M175 102 Q165 100 158 94" stroke="#cc2a2a" stroke-width="1.4" fill="none"/>
                <path d="M175 108 Q165 110 158 116" stroke="#1a1a1a" stroke-width="1.4" fill="none"/>
              </g>
            </g>

            <!-- BLE chip -->
            <g class="abc-part" data-id="ble">
              <g class="glow-target">
                <rect x="400" y="175" width="30" height="22" rx="2" fill="#1a1a1a" stroke="#000" stroke-width="0.4"/>
                <rect x="402" y="177" width="26" height="18" rx="1.2" fill="#2a2a2a"/>
                <g fill="#aaa">
                  <rect x="405" y="180" width="2" height="2"/>
                  <rect x="408" y="180" width="2" height="2"/>
                  <rect x="411" y="180" width="2" height="2"/>
                  <rect x="405" y="183" width="2" height="2"/>
                  <rect x="411" y="183" width="2" height="2"/>
                  <rect x="408" y="186" width="2" height="2"/>
                </g>
              </g>
            </g>

            <!-- Temp/Humidity -->
            <g class="abc-part" data-id="temp">
              <g class="glow-target">
                <rect x="110" y="105" width="28" height="22" rx="2" fill="#fafafa" stroke="#888" stroke-width="0.4"/>
                <rect x="113" y="108" width="22" height="16" rx="1.2" fill="#e8e8e8"/>
                <circle cx="120" cy="116" r="1.2" fill="#4a7ab8" opacity="0.5"/>
                <circle cx="124" cy="116" r="1.2" fill="#4a7ab8" opacity="0.5"/>
                <circle cx="128" cy="116" r="1.2" fill="#4a7ab8" opacity="0.5"/>
              </g>
            </g>

            <!-- PM2.5 Plantower -->
            <g class="abc-part" data-id="pm25">
              <g class="glow-target">
                <rect x="130" y="155" width="175" height="145" rx="5" fill="url(#plantower-metal)" stroke="#2d5a70" stroke-width="0.6"/>
                <rect x="130" y="155" width="175" height="145" rx="5" fill="url(#brushed)" pointer-events="none"/>
                <rect x="135" y="160" width="165" height="135" rx="3.5" fill="none" stroke="#3a6a80" stroke-width="0.4" opacity="0.5"/>
                <circle cx="140" cy="165" r="1.4" fill="#4a6a80" stroke="#2a4a60" stroke-width="0.25"/>
                <circle cx="295" cy="165" r="1.4" fill="#4a6a80" stroke="#2a4a60" stroke-width="0.25"/>
                <circle cx="140" cy="290" r="1.4" fill="#4a6a80" stroke="#2a4a60" stroke-width="0.25"/>
                <circle cx="295" cy="290" r="1.4" fill="#4a6a80" stroke="#2a4a60" stroke-width="0.25"/>
                <text x="217" y="235" text-anchor="middle" fill="#2d5a70" font-size="13" font-weight="600" letter-spacing="2.5" opacity="0.7" font-family="inherit">PLANTOWER</text>
                <g id="pm-intake-vent">
                  <rect x="130" y="200" width="6" height="55" fill="#2d5a70" opacity="0.6"/>
                  <g stroke="#1a3a50" stroke-width="0.5">
                    <line x1="131" y1="205" x2="135" y2="205"/>
                    <line x1="131" y1="212" x2="135" y2="212"/>
                    <line x1="131" y1="219" x2="135" y2="219"/>
                    <line x1="131" y1="226" x2="135" y2="226"/>
                    <line x1="131" y1="233" x2="135" y2="233"/>
                    <line x1="131" y1="240" x2="135" y2="240"/>
                    <line x1="131" y1="247" x2="135" y2="247"/>
                  </g>
                </g>
                <g id="pm-exhaust-vent">
                  <rect x="299" y="200" width="6" height="55" fill="#2d5a70" opacity="0.6"/>
                  <g stroke="#1a3a50" stroke-width="0.5">
                    <line x1="300" y1="205" x2="304" y2="205"/>
                    <line x1="300" y1="212" x2="304" y2="212"/>
                    <line x1="300" y1="219" x2="304" y2="219"/>
                    <line x1="300" y1="226" x2="304" y2="226"/>
                    <line x1="300" y1="233" x2="304" y2="233"/>
                    <line x1="300" y1="240" x2="304" y2="240"/>
                    <line x1="300" y1="247" x2="304" y2="247"/>
                  </g>
                </g>
              </g>
            </g>

            <!-- CO sensor -->
            <g class="abc-part" data-id="co">
              <g class="glow-target">
                <rect x="315" y="195" width="105" height="100" rx="3" fill="#1a5436" stroke="#0a3020" stroke-width="0.5"/>
                <rect x="315" y="195" width="105" height="100" rx="3" fill="url(#pcb-traces)" pointer-events="none"/>
                <circle cx="367" cy="248" r="42" fill="#000" opacity="0.12"/>
                <circle cx="367" cy="245" r="40" fill="url(#co-disc)" stroke="#1a2a60" stroke-width="0.6"/>
                <circle cx="367" cy="245" r="35" fill="none" stroke="#2a3a7a" stroke-width="0.5" opacity="0.6"/>
                <circle cx="367" cy="245" r="28" fill="none" stroke="#2a3a7a" stroke-width="0.4" opacity="0.5"/>
                <circle cx="367" cy="245" r="20" fill="none" stroke="#2a3a7a" stroke-width="0.3" opacity="0.4"/>
                <g fill="#0a1530" opacity="0.45">
                  <circle cx="358" cy="240" r="0.8"/>
                  <circle cx="365" cy="238" r="0.8"/>
                  <circle cx="372" cy="240" r="0.8"/>
                  <circle cx="378" cy="245" r="0.8"/>
                  <circle cx="375" cy="252" r="0.8"/>
                  <circle cx="368" cy="254" r="0.8"/>
                  <circle cx="361" cy="252" r="0.8"/>
                  <circle cx="356" cy="246" r="0.8"/>
                  <circle cx="367" cy="245" r="0.8"/>
                </g>
                <ellipse cx="355" cy="232" rx="10" ry="5" fill="#fff" opacity="0.18"/>
              </g>
            </g>

            <!-- Airflow (top view) -->
            <g id="airflow-top" style="display:none;" clip-path="url(#device-clip)">
              <g opacity="0.65">
                <path d="M50 215 L75 220" stroke="#2b7fa8" stroke-width="2.4" fill="none" stroke-linecap="round" marker-end="url(#abc-arrow)"/>
                <path d="M50 240 L75 235" stroke="#2b7fa8" stroke-width="2.4" fill="none" stroke-linecap="round" marker-end="url(#abc-arrow)"/>
                <text x="20" y="234" font-size="13" fill="#2b7fa8" font-weight="500" font-family="inherit">Air in</text>
              </g>
              <g opacity="0.6">
                <path d="M445 215 L470 220" stroke="#7b7b80" stroke-width="2.4" fill="none" stroke-linecap="round" marker-end="url(#abc-arrow)"/>
                <path d="M445 240 L470 235" stroke="#7b7b80" stroke-width="2.4" fill="none" stroke-linecap="round" marker-end="url(#abc-arrow)"/>
                <text x="446" y="264" font-size="13" fill="#515154" font-weight="500" font-family="inherit">Air out</text>
              </g>
              <g opacity="0.65">
                <path d="M367 320 L367 300" stroke="#e0b3f0" stroke-width="2.4" fill="none" stroke-linecap="round" marker-end="url(#abc-arrow)"/>
                <text x="378" y="320" font-size="13" fill="#e0b3f0" font-weight="500" font-family="inherit">CO molecules</text>
              </g>
              <g id="particles-container"></g>
            </g>

            <!-- Look inside button -->
            <g id="abc-look-inside" style="cursor:pointer; display:none;">
              <rect x="158" y="218" width="120" height="32" rx="16" fill="rgba(255,255,255,0.95)" stroke="rgba(0,0,0,0.08)" stroke-width="0.5"/>
              <text x="218" y="238" text-anchor="middle" font-size="12" font-weight="500" fill="#1d1d1f" font-family="inherit">Look inside ↗</text>
            </g>
          </g>

          <!-- ============ CUTAWAY VIEW ============ -->
          <g id="view-cut" style="display:none;">
            <text x="260" y="38" text-anchor="middle" font-size="14" font-weight="600" fill="#1d1d1f" font-family="inherit">Inside the PM 2.5 sensor</text>

            <rect x="60" y="80" width="400" height="280" rx="10" fill="url(#plantower-metal)" stroke="#2d5a70" stroke-width="0.8"/>
            <rect x="60" y="80" width="400" height="280" rx="10" fill="url(#brushed)"/>
            <rect x="80" y="105" width="360" height="230" rx="6" fill="#1a2a35" stroke="#2d5a70" stroke-width="0.6"/>

            <rect x="60" y="200" width="20" height="40" fill="#1a2a35"/>
            <g stroke="#2d5a70" stroke-width="0.5">
              <line x1="65" y1="208" x2="80" y2="208"/>
              <line x1="65" y1="218" x2="80" y2="218"/>
              <line x1="65" y1="228" x2="80" y2="228"/>
            </g>
            <rect x="440" y="200" width="20" height="40" fill="#1a2a35"/>
            <g stroke="#2d5a70" stroke-width="0.5">
              <line x1="440" y1="208" x2="455" y2="208"/>
              <line x1="440" y1="218" x2="455" y2="218"/>
              <line x1="440" y1="228" x2="455" y2="228"/>
            </g>

            <g id="cut-fan" transform="translate(395 220)">
              <circle r="34" fill="#2a3a45" stroke="#4a5a65" stroke-width="0.6"/>
              <circle r="32" fill="#1a2a35"/>
              <g id="fan-blades">
                <g>
                  <ellipse cx="0" cy="-16" rx="5" ry="14" fill="#5a7080" opacity="0.85"/>
                  <ellipse cx="14" cy="8" rx="5" ry="14" fill="#5a7080" opacity="0.85" transform="rotate(120)"/>
                  <ellipse cx="-14" cy="8" rx="5" ry="14" fill="#5a7080" opacity="0.85" transform="rotate(240)"/>
                </g>
              </g>
              <circle r="5" fill="#2a3a45" stroke="#4a5a65" stroke-width="0.5"/>
            </g>
            <text x="395" y="290" text-anchor="middle" font-size="11" fill="rgba(255,255,255,0.7)" font-family="inherit">Fan</text>

            <g transform="translate(180 130)">
              <rect x="-15" y="-10" width="30" height="20" rx="2.5" fill="#3a3a3a" stroke="#1a1a1a" stroke-width="0.5"/>
              <circle cx="0" cy="6" r="3" fill="#ff5050" stroke="#a02020" stroke-width="0.4"/>
            </g>
            <text x="180" y="118" text-anchor="middle" font-size="11" fill="rgba(255,255,255,0.7)" font-family="inherit">Laser diode</text>

            <g transform="translate(280 320)">
              <rect x="-15" y="-10" width="30" height="20" rx="2.5" fill="#3a3a3a" stroke="#1a1a1a" stroke-width="0.5"/>
              <rect id="photodiode-sensor" x="-8" y="-5" width="16" height="10" fill="#1a4060" stroke="#0a2030" stroke-width="0.4"/>
              <rect id="photodiode-glow" x="-8" y="-5" width="16" height="10" fill="#6ab8e0" opacity="0" pointer-events="none"/>
            </g>
            <text x="280" y="350" text-anchor="middle" font-size="11" fill="rgba(255,255,255,0.7)" font-family="inherit">Photodiode</text>

            <g id="laser-beam" style="display:none;">
              <line id="laser-line-glow" x1="180" y1="139" x2="280" y2="315" stroke="#ff3030" stroke-width="2" opacity="0.7"/>
              <line id="laser-line-core" x1="180" y1="139" x2="280" y2="315" stroke="#ff8080" stroke-width="0.8" opacity="0.9"/>
              <circle cx="180" cy="139" r="6" fill="url(#laser-glow)"/>
            </g>

            <g id="scatter-point" style="display:none;">
              <circle id="scatter-flash-circle" cx="220" cy="210" r="9" fill="url(#laser-glow)"/>
              <line id="scatter-line" x1="220" y1="210" x2="280" y2="315" stroke="#ffaaaa" stroke-width="1.5" opacity="0.8" stroke-dasharray="3 2"/>
            </g>

            <g id="cut-particles"></g>

            <g id="cut-labels" style="display:none;">
              <g opacity="0.85">
                <path d="M30 220 L58 220" stroke="#2b7fa8" stroke-width="2.4" fill="none" marker-end="url(#abc-arrow)"/>
                <text x="28" y="215" text-anchor="end" font-size="11" fill="#3a8fb8" font-weight="500" font-family="inherit">Air in</text>
              </g>
              <g opacity="0.85">
                <path d="M462 220 L490 220" stroke="#7b7b80" stroke-width="2.4" fill="none" marker-end="url(#abc-arrow)"/>
                <text x="492" y="225" font-size="11" fill="#666" font-weight="500" font-family="inherit">Air out</text>
              </g>
            </g>
          </g>
        </svg>
      <div id="abc-hint">Hover or tap a part</div>
    </div>
      <div id="abc-panel">
        <div id="abc-default">
          <div id="abc-default-badge">AirStory Sensor</div>
          <div id="abc-default-title">A palm-sized air quality sensor.</div>
          <div id="abc-default-body">Developed by Tamgu Lab @ Teachers College. Hover or tap a part to see how it works.</div>
        </div>
        <div id="abc-detail">
          <div id="abc-badge"></div>
          <div id="abc-title"></div>
          <div id="abc-what"></div>
          <div>
            <div class="abc-how-label">How it works</div>
            <div id="abc-how"></div>
          </div>
          <button id="abc-askmore" type="button">Ask more ↗</button>
        </div>
      </div>
  </div>
  <div class="sensor-side">
    <div id="sim-block">
      <div class="simcard" id="sim-card">
        <div class="sim-gate" id="sim-gate">
          <p class="t-small"><strong>Take the sensor for a walk</strong></p>
          <p class="t-small muted sim-gate-copy">See how the same sensor responds as the air changes.</p>
          <button class="sim-start" id="sim-start" type="button">Start with airflow <span aria-hidden="true">→</span></button>
        </div>
        <div class="sim-story" id="sim-story" aria-hidden="true">
          <div class="sim-ready-line"><span class="sim-ready-dot"></span><span>Air is moving through the sensor.</span></div>
          <p class="t-small sim-next">Now take it somewhere.</p>
          <div class="stops" id="sim-stops">
            <button data-i="0"><span class="stop-main"><span class="s-name">City park</span><span class="s-bar"><i></i></span><span class="s-val">8</span></span><span class="stop-detail"><span class="stop-detail-inner"></span></span></button>
            <button data-i="1"><span class="stop-main"><span class="s-name">Your classroom</span><span class="s-bar"><i></i></span><span class="s-val">12</span></span><span class="stop-detail"><span class="stop-detail-inner"></span></span></button>
            <button data-i="2"><span class="stop-main"><span class="s-name">Aboveground station</span><span class="s-bar"><i></i></span><span class="s-val">29</span></span><span class="stop-detail"><span class="stop-detail-inner"></span></span></button>
            <button data-i="3"><span class="stop-main"><span class="s-name">Inside a train car</span><span class="s-bar"><i></i></span><span class="s-val">88</span></span><span class="stop-detail"><span class="stop-detail-inner"></span></span></button>
            <button data-i="4"><span class="stop-main"><span class="s-name">Underground platform</span><span class="s-bar"><i></i></span><span class="s-val">142</span></span><span class="stop-detail"><span class="stop-detail-inner"></span></span></button>
          </div>
          <div class="epaline"><span></span><span class="t-cap muted">EPA 24-hour standard &middot; 35 &micro;g/m&sup3;</span></div>
          <button class="btn btn--sm btn--outline btn--wide" id="sim-play" style="margin-top:16px">Play the whole walk</button>
        </div>
      </div>
    </div>
  </div>
  </div>
</div>
`;

export default deviceExplorerMarkup;
