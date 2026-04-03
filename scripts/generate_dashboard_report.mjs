import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

const root = process.cwd()

function readFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function getConnectionStrings() {
  const text = readFile('supabase.txt')
  const matches = [...text.matchAll(/postgresql:\/\/[^\s`]+/g)].map((m) => m[0])
  if (!matches.length) throw new Error('No PostgreSQL connection string found in supabase.txt')
  const direct = matches.find((value) => value.includes('@db.'))
  const pooler = matches.find((value) => value.includes('pooler.supabase.com'))
  return [direct, pooler].filter(Boolean)
}

async function connectWithFallback() {
  let lastError = null
  for (const connectionString of getConnectionStrings()) {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
    try {
      await client.connect()
      console.log(`Connected using ${connectionString.includes('pooler.supabase.com') ? 'pooler' : 'direct'} endpoint`)
      return client
    } catch (error) {
      lastError = error
      try {
        await client.end()
      } catch {
      }
    }
  }
  throw lastError || new Error('Unable to connect to Supabase')
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '-'
  return new Intl.NumberFormat('en-AU').format(Number(value))
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    regionGroup: 'Greater Sydney',
    label: 'Sydney',
    outputName: 'latest-report'
  }
  for (const arg of args) {
    if (arg.startsWith('--region-group=')) options.regionGroup = arg.split('=')[1].trim()
    if (arg.startsWith('--label=')) options.label = arg.split('=')[1].trim()
    if (arg.startsWith('--output-name=')) options.outputName = arg.split('=')[1].trim()
  }
  return options
}

function htmlTemplate(data) {
  const generatedAt = new Date().toLocaleString('en-AU', { hour12: false })
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${data.reportTitle}</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script>
    (() => {
      const storageKey = 'radarestate-theme';
      let stored = null;
      try {
        stored = window.localStorage.getItem(storageKey);
      } catch {
      }
      const preferred = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      document.documentElement.dataset.theme = stored || preferred;
    })();
  </script>
  <style>
    :root {
      --bg: #0b1020;
      --bg-accent: #132048;
      --panel: #121932;
      --panel-2: #171f3d;
      --text: #e9eefc;
      --muted: #92a0c4;
      --line: #273154;
      --cyan: #33d1ff;
      --lime: #b7ff3c;
      --pink: #ff5daa;
      --amber: #ffb547;
      --red: #ff6b6b;
      --grid: rgba(146,160,196,0.12);
      --panel-top: rgba(255,255,255,0.03);
      --panel-bottom: rgba(255,255,255,0.01);
      --shadow: rgba(0,0,0,0.18);
      --button-bg: rgba(255,255,255,0.06);
      --button-text: var(--text);
      --map-bg: #0f1731;
      --popup-bg: #ffffff;
      --popup-text: #0b1020;
      --popup-border: rgba(11,16,32,0.12);
      --table-header: var(--muted);
    }

    html[data-theme="light"] {
      --bg: #eef4ff;
      --bg-accent: #d9e8ff;
      --panel: #ffffff;
      --panel-2: #f4f8ff;
      --text: #11203f;
      --muted: #597094;
      --line: #d3def0;
      --cyan: #0f84c9;
      --lime: #6eab12;
      --pink: #d64588;
      --amber: #d6861b;
      --red: #c94242;
      --grid: rgba(89,112,148,0.16);
      --panel-top: rgba(255,255,255,0.92);
      --panel-bottom: rgba(240,246,255,0.92);
      --shadow: rgba(45,72,117,0.12);
      --button-bg: #ffffff;
      --button-text: #11203f;
      --map-bg: #dbe8f7;
      --popup-bg: #ffffff;
      --popup-text: #11203f;
      --popup-border: rgba(17,32,63,0.12);
      --table-header: #4f6485;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, Arial, sans-serif;
      background: radial-gradient(circle at top left, var(--bg-accent) 0, var(--bg) 40%);
      color: var(--text);
    }
    .page {
      max-width: 1440px;
      margin: 0 auto;
      padding: 88px 28px 28px;
    }
    .theme-switcher {
      position: fixed;
      top: 18px;
      right: 18px;
      z-index: 1200;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel-top), var(--panel-bottom));
      box-shadow: 0 12px 30px var(--shadow);
      backdrop-filter: blur(10px);
    }
    .theme-switcher-label {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .theme-switcher-group {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px;
      border-radius: 999px;
      background: var(--panel-2);
      border: 1px solid var(--line);
    }
    .theme-switcher-button {
      appearance: none;
      border: none;
      background: transparent;
      color: var(--muted);
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      min-width: 68px;
    }
    .theme-switcher-button[aria-pressed="true"] {
      background: var(--button-bg);
      color: var(--button-text);
      box-shadow: inset 0 0 0 1px var(--line);
    }
    .hero {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    .hero-card, .panel {
      background: linear-gradient(180deg, var(--panel-top), var(--panel-bottom));
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 22px;
      box-shadow: 0 16px 40px var(--shadow);
    }
    .eyebrow {
      color: var(--cyan);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 12px;
      margin-bottom: 10px;
    }
    h1 {
      margin: 0 0 12px;
      font-size: 34px;
      line-height: 1.1;
    }
    .lede {
      color: var(--muted);
      font-size: 15px;
      line-height: 1.6;
      margin: 0;
    }
    .meta {
      display: grid;
      gap: 10px;
      align-content: start;
    }
    .meta-row {
      padding: 14px 16px;
      border-radius: 14px;
      background: var(--panel-2);
      border: 1px solid var(--line);
    }
    .meta-label {
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .meta-value {
      font-size: 24px;
      font-weight: 700;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 20px;
    }
    .span-6 { grid-column: span 6; }
    .span-7 { grid-column: span 7; }
    .span-5 { grid-column: span 5; }
    .span-12 { grid-column: span 12; }
    .panel h2 {
      margin: 0 0 14px;
      font-size: 18px;
    }
    .subtle {
      color: var(--muted);
      font-size: 13px;
      margin-top: -4px;
      margin-bottom: 16px;
    }
    canvas { width: 100% !important; height: 320px !important; }
    #precinctMap {
      height: 460px;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid var(--line);
    }
    .leaflet-container {
      background: var(--map-bg);
      font-family: Inter, Arial, sans-serif;
    }
    .map-popup {
      color: var(--popup-text);
      line-height: 1.5;
      min-width: 220px;
    }
    .map-popup strong {
      display: block;
      margin-bottom: 6px;
      font-size: 14px;
    }
    .legend {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      margin: 12px 0 18px;
      color: var(--muted);
      font-size: 12px;
    }
    .legend-item {
      display: inline-flex;
      gap: 8px;
      align-items: center;
    }
    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      display: inline-block;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      padding: 12px 10px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }
    th {
      color: var(--table-header);
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .leaflet-popup-content-wrapper,
    .leaflet-popup-tip {
      background: var(--popup-bg);
      color: var(--popup-text);
      box-shadow: 0 12px 30px rgba(0,0,0,0.16);
      border: 1px solid var(--popup-border);
    }
    .tag {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      background: rgba(51, 209, 255, 0.14);
      color: var(--cyan);
    }
    .footer-note {
      color: var(--muted);
      font-size: 12px;
      margin-top: 16px;
    }
    @media (max-width: 980px) {
      .page { padding: 92px 18px 18px; }
      .theme-switcher {
        left: 18px;
        right: 18px;
        justify-content: space-between;
      }
      .hero { grid-template-columns: 1fr; }
      .span-6, .span-7, .span-5, .span-12 { grid-column: span 12; }
    }
  </style>
</head>
<body>
  <div class="theme-switcher" role="group" aria-label="Theme switcher">
    <span class="theme-switcher-label">Theme</span>
    <div class="theme-switcher-group">
      <button class="theme-switcher-button" type="button" data-theme-option="dark">Dark</button>
      <button class="theme-switcher-button" type="button" data-theme-option="light">Light</button>
    </div>
  </div>
  <div class="page">
    <section class="hero">
      <div class="hero-card">
        <div class="eyebrow">RadarEstate</div>
        <h1>${data.reportTitle}</h1>
        <p class="lede">${data.reportLede}</p>
      </div>
      <div class="meta">
        <div class="meta-row">
          <div class="meta-label">Planning Proposals</div>
          <div class="meta-value">${formatNumber(data.meta.totalPlanningProposals)}</div>
        </div>
        <div class="meta-row">
          <div class="meta-label">Application Signals</div>
          <div class="meta-value">${formatNumber(data.meta.totalApplicationSignals)}</div>
        </div>
        <div class="meta-row">
          <div class="meta-label">Precinct Shortlist</div>
          <div class="meta-value">${formatNumber(data.meta.totalPrecinctShortlist)}</div>
        </div>
        <div class="meta-row">
          <div class="meta-label">Derived Constraints</div>
          <div class="meta-value">${formatNumber(data.meta.totalConstraints)}</div>
        </div>
        <div class="meta-row">
          <div class="meta-label">Generated</div>
          <div class="meta-value" style="font-size:16px">${generatedAt}</div>
        </div>
      </div>
    </section>

    <section class="grid">
      <div class="panel span-12">
        <h2>Precinct Opportunity Map</h2>
        <p class="subtle">Map points are application-derived precinct centroids. Marker colour reflects current shortlist rating and marker size scales with recent application activity.</p>
        <div class="legend">
          <span class="legend-item"><span class="legend-dot" style="background:#b7ff3c"></span>A-rated precinct</span>
          <span class="legend-item"><span class="legend-dot" style="background:#33d1ff"></span>B-rated precinct</span>
          <span class="legend-item"><span class="legend-dot" style="background:#ffb547"></span>C-rated precinct</span>
          <span class="legend-item"><span class="legend-dot" style="background:#ff6b6b"></span>High friction</span>
        </div>
        <div id="precinctMap"></div>
      </div>

      <div class="panel span-6">
        <h2>Recent Activity Ranking</h2>
        <p class="subtle">Recent applications from the current focus-council sync window.</p>
        <canvas id="recentActivityChart"></canvas>
      </div>
      <div class="panel span-6">
        <h2>Policy Pipeline</h2>
        <p class="subtle">Planning proposal distribution by stage.</p>
        <canvas id="pipelineChart"></canvas>
      </div>

      <div class="panel span-7">
        <h2>Target Pressure Vs Recent Activity</h2>
        <p class="subtle">Councils with both target pressure and current activity are strongest first-pass shortlist candidates.</p>
        <canvas id="scatterChart"></canvas>
      </div>

      <div class="panel span-5">
        <h2>High-Conviction Council Table</h2>
        <p class="subtle">Top councils by active pipeline count with target and recent activity context.</p>
        <table>
          <thead>
            <tr>
              <th>Council</th>
              <th>Pipeline</th>
              <th>Target</th>
              <th>Recent Apps</th>
            </tr>
          </thead>
          <tbody>
            ${data.scoreboard.map((row) => `
              <tr>
                <td>${row.council_name}</td>
                <td>${formatNumber(row.active_pipeline_count)}</td>
                <td>${formatNumber(row.target_value)}</td>
                <td>${formatNumber(row.application_recent_count)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="panel span-6">
        <h2>Top Precinct Shortlist</h2>
        <p class="subtle">First-pass precinct seed built from mapped proposal and application signals.</p>
        <canvas id="precinctChart"></canvas>
      </div>

      <div class="panel span-6">
        <h2>Precinct Shortlist Table</h2>
        <p class="subtle">Heuristic shortlist only. Constraints and site assembly are not integrated yet.</p>
        <table>
          <thead>
            <tr>
              <th>Precinct</th>
              <th>Rating</th>
              <th>Risk</th>
              <th>Recent Apps</th>
              <th>Pipeline</th>
            </tr>
          </thead>
          <tbody>
            ${data.precinctShortlist.map((row) => `
              <tr>
                <td>${row.precinct_name}<br><span style="color:var(--muted);font-size:12px">${row.constraint_summary ?? 'No derived constraint hit'}</span></td>
                <td><span class="tag">${row.opportunity_rating}</span></td>
                <td>${formatNumber(row.friction_score)}</td>
                <td>${formatNumber(row.recent_application_count)}</td>
                <td>${formatNumber(row.active_pipeline_count)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="panel span-12">
        <h2>Most Constrained Precincts</h2>
        <p class="subtle">This panel surfaces where policy or activity may be real, but environmental or process friction is already visible in the first-pass proxy layer.</p>
        <table>
          <thead>
            <tr>
              <th>Precinct</th>
              <th>Council</th>
              <th>Risk</th>
              <th>Summary</th>
              <th>Recent Apps</th>
              <th>Pipeline</th>
            </tr>
          </thead>
          <tbody>
            ${data.constrainedPrecincts.map((row) => `
              <tr>
                <td>${row.precinct_name}</td>
                <td>${row.council_name}</td>
                <td>${formatNumber(row.friction_score)}</td>
                <td>${row.constraint_summary ?? '-'}</td>
                <td>${formatNumber(row.recent_application_count)}</td>
                <td>${formatNumber(row.active_pipeline_count)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="panel span-12">
        <h2>Sydney Proposal Watchlist</h2>
        <p class="subtle">Current policy movement from the synced watchlist view.</p>
        <table>
          <thead>
            <tr>
              <th>Stage</th>
              <th>Council</th>
              <th>Title</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            ${data.watchlist.map((row) => `
              <tr>
                <td><span class="tag">${row.stage}</span></td>
                <td>${row.council_name ?? '-'}</td>
                <td>${row.title}</td>
                <td>${row.location_text ?? '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer-note">This dashboard is intentionally council-level and policy-level first. Precinct and site-level mapping should only be pushed after tighter geography matching and constraints integration.</div>
      </div>
    </section>
  </div>

  <script>
    const reportData = ${safeJson(data)};
    const storageKey = 'radarestate-theme';
    const currentTheme = document.documentElement.dataset.theme || 'dark';
    const themeButtons = [...document.querySelectorAll('[data-theme-option]')];

    const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const axisColor = cssVar('--muted');
    const gridColor = cssVar('--grid');

    themeButtons.forEach((button) => {
      const theme = button.dataset.themeOption;
      button.setAttribute('aria-pressed', theme === currentTheme ? 'true' : 'false');
      button.addEventListener('click', () => {
        if (theme === currentTheme) return;
        try {
          window.localStorage.setItem(storageKey, theme);
        } catch {
        }
        document.documentElement.dataset.theme = theme;
        window.location.reload();
      });
    });

    const ratingColor = (rating, friction) => {
      if ((friction || 0) >= 5) return '#ff6b6b';
      if (rating === 'A') return '#b7ff3c';
      if (rating === 'B') return '#33d1ff';
      return '#ffb547';
    };

    const precinctMap = L.map('precinctMap', { zoomControl: true, scrollWheelZoom: false });
    const tileUrl = currentTheme === 'light'
      ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    L.tileLayer(tileUrl, {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(precinctMap);

    const mapPoints = reportData.precinctMapPoints
      .filter((row) => row.centroid_latitude !== null && row.centroid_longitude !== null)
      .map((row) => {
        const recent = Number(row.recent_application_count || 0);
        const radius = Math.max(7, Math.min(22, 7 + Math.sqrt(recent) * 0.55));
        const color = ratingColor(row.opportunity_rating, Number(row.friction_score || 0));
        const marker = L.circleMarker([Number(row.centroid_latitude), Number(row.centroid_longitude)], {
          radius,
          color,
          weight: 1,
          fillColor: color,
          fillOpacity: 0.75
        });
        marker.bindPopup(
          '<div class="map-popup">' +
            '<strong>' + row.precinct_name + '</strong>' +
            'Council: ' + (row.council_name || '-') + '<br>' +
            'Rating: ' + row.opportunity_rating + '<br>' +
            'Recent apps: ' + recent + '<br>' +
            'Active pipeline: ' + Number(row.active_pipeline_count || 0) + '<br>' +
            'Risk score: ' + Number(row.friction_score || 0) + '<br>' +
            'Constraints: ' + (row.constraint_summary || 'None') +
          '</div>'
        );
        return marker;
      });

    const precinctLayer = L.featureGroup(mapPoints).addTo(precinctMap);
    if (mapPoints.length) {
      precinctMap.fitBounds(precinctLayer.getBounds().pad(0.12));
    } else {
      precinctMap.setView([-33.87, 151.05], 10);
    }

    Chart.defaults.color = axisColor;
    Chart.defaults.borderColor = gridColor;
    Chart.defaults.font.family = 'Inter, Arial, sans-serif';

    new Chart(document.getElementById('recentActivityChart'), {
      type: 'bar',
      data: {
        labels: reportData.recentRanking.map((row) => row.council_name),
        datasets: [{
          label: 'Recent Applications',
          data: reportData.recentRanking.map((row) => Number(row.recent_count || 0)),
          backgroundColor: '#33d1ff',
          borderRadius: 8
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxRotation: 45, minRotation: 45 } },
          y: { beginAtZero: true }
        }
      }
    });

    new Chart(document.getElementById('pipelineChart'), {
      type: 'bar',
      data: {
        labels: reportData.pipeline.map((row) => row.stage),
        datasets: [{
          label: 'Proposal Count',
          data: reportData.pipeline.map((row) => Number(row.proposal_count || 0)),
          backgroundColor: ['#33d1ff', '#7dd3fc', '#b7ff3c', '#ffb547', '#ff5daa', '#ff6b6b'],
          borderRadius: 8
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });

    new Chart(document.getElementById('scatterChart'), {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Councils',
          data: reportData.scatter
            .filter((row) => row.target_value !== null && row.application_recent_count !== null)
            .map((row) => ({
              x: Number(row.target_value),
              y: Number(row.application_recent_count),
              label: row.council_name
            })),
          backgroundColor: '#b7ff3c',
          pointRadius: 6,
          pointHoverRadius: 8
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                const label = context.raw.label ? context.raw.label + ': ' : '';
                return label + 'target ' + context.raw.x + ', recent ' + context.raw.y;
              }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: '5-year target' } },
          y: { title: { display: true, text: 'Recent applications' }, beginAtZero: true }
        }
      }
    });

    new Chart(document.getElementById('precinctChart'), {
      type: 'bar',
      data: {
        labels: reportData.precinctShortlist.map((row) => row.precinct_name),
        datasets: [{
          label: 'Recent Applications',
          data: reportData.precinctShortlist.map((row) => Number(row.recent_application_count || 0)),
          backgroundColor: reportData.precinctShortlist.map((row) => row.opportunity_rating === 'A' ? '#b7ff3c' : row.opportunity_rating === 'B' ? '#33d1ff' : '#ffb547'),
          borderRadius: 8
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxRotation: 45, minRotation: 45 } },
          y: { beginAtZero: true }
        }
      }
    });
  </script>
</body>
</html>`
}

async function main() {
  const options = parseArgs()
  const client = await connectWithFallback()
  try {
    const metaPlanning = await client.query(`select count(*)::int as total from public.planning_proposals pp join public.councils c on c.id = pp.council_id where c.region_group = $1`, [options.regionGroup])
    const metaApps = await client.query(`select count(*)::int as total from public.application_signals a join public.councils c on c.id = a.council_id where c.region_group = $1`, [options.regionGroup])
    const metaPrecinct = await client.query(`select count(*)::int as total from public.v_precinct_shortlist v join public.councils c on c.canonical_name = v.council_name where c.region_group = $1`, [options.regionGroup])
    const metaConstraints = await client.query(`select count(*)::int as total from public.constraints ct join public.precincts p on p.id = ct.precinct_id join public.councils c on c.id = p.primary_council_id where c.region_group = $1`, [options.regionGroup])
    const recentRanking = await client.query(`select v.council_name, v.recent_count, v.total_count from public.v_recent_application_ranking v join public.councils c on c.canonical_name = v.council_name where c.region_group = $1 limit 10`, [options.regionGroup])
    const pipeline = await client.query(`select pp.stage, pp.stage_rank, count(*)::int as proposal_count from public.planning_proposals pp join public.councils c on c.id = pp.council_id where c.region_group = $1 group by pp.stage, pp.stage_rank order by pp.stage_rank nulls last, pp.stage`, [options.regionGroup])
    const scoreboard = await client.query(`select council_name, target_value, application_recent_count, active_pipeline_count from public.v_council_scoreboard where region_group = $1 order by active_pipeline_count desc nulls last, made_count desc nulls last limit 12`, [options.regionGroup])
    const scatter = await client.query(`select council_name, target_value, application_recent_count from public.v_target_pressure_vs_activity where region_group = $1 and target_value is not null and application_recent_count is not null order by target_value desc nulls last`, [options.regionGroup])
    const watchlist = await client.query(`select c.canonical_name as council_name, pp.stage, pp.title, pp.location_text from public.planning_proposals pp join public.councils c on c.id = pp.council_id where c.region_group = $1 and pp.stage in ('under_assessment','pre_exhibition','on_exhibition','finalisation') order by pp.stage_rank nulls last, pp.last_seen_at desc, pp.title limit 20`, [options.regionGroup])
    const precinctShortlist = await client.query(`select v.precinct_name, v.council_name, v.opportunity_rating, v.friction_score, v.recent_application_count, v.active_pipeline_count, v.constraint_summary from public.v_precinct_shortlist v join public.councils c on c.canonical_name = v.council_name where c.region_group = $1 order by case v.opportunity_rating when 'A' then 1 when 'B' then 2 else 3 end, v.friction_score asc nulls last, v.recent_application_count desc nulls last limit 12`, [options.regionGroup])
    const constrainedPrecincts = await client.query(`select v.precinct_name, v.council_name, v.friction_score, v.constraint_summary, v.recent_application_count, v.active_pipeline_count from public.v_precinct_shortlist v join public.councils c on c.canonical_name = v.council_name where c.region_group = $1 and v.constraint_count > 0 order by v.friction_score desc, v.recent_application_count desc limit 12`, [options.regionGroup])
    const precinctMapPoints = await client.query(`select v.precinct_name, v.council_name, v.opportunity_rating, v.friction_score, v.recent_application_count, v.active_pipeline_count, v.constraint_summary, v.centroid_latitude, v.centroid_longitude, v.point_count from public.v_precinct_map_points v join public.councils c on c.canonical_name = v.council_name where c.region_group = $1`, [options.regionGroup])

    const data = {
      reportTitle: `${options.label} Planning And Activity Research Dashboard`,
      reportLede: `Public-data powered view across housing target pressure, planning proposal pipeline, recent development activity and first-pass risk signals for ${options.label}. This report is generated directly from Supabase views, not from mock sample JSON.`,
      meta: {
        totalPlanningProposals: metaPlanning.rows[0].total,
        totalApplicationSignals: metaApps.rows[0].total,
        totalPrecinctShortlist: metaPrecinct.rows[0].total,
        totalConstraints: metaConstraints.rows[0].total
      },
      recentRanking: recentRanking.rows,
      pipeline: pipeline.rows,
      scoreboard: scoreboard.rows,
      scatter: scatter.rows,
      watchlist: watchlist.rows,
      precinctShortlist: precinctShortlist.rows,
      constrainedPrecincts: constrainedPrecincts.rows,
      precinctMapPoints: precinctMapPoints.rows
    }

    const dashboardDir = path.join(root, 'dashboard')
    fs.mkdirSync(dashboardDir, { recursive: true })
    const outputPath = path.join(dashboardDir, `${options.outputName}.html`)
    fs.writeFileSync(outputPath, htmlTemplate(data), 'utf8')
    console.log(`Wrote ${outputPath}`)
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
