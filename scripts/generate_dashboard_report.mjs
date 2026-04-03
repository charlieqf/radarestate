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

function htmlTemplate(data) {
  const generatedAt = new Date().toLocaleString('en-AU', { hour12: false })
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RadarEstate Research Dashboard</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <style>
    :root {
      --bg: #0b1020;
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
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, Arial, sans-serif;
      background: radial-gradient(circle at top left, #132048 0, var(--bg) 40%);
      color: var(--text);
    }
    .page {
      max-width: 1440px;
      margin: 0 auto;
      padding: 28px;
    }
    .hero {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    .hero-card, .panel {
      background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 22px;
      box-shadow: 0 16px 40px rgba(0,0,0,0.18);
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
      background: #0f1731;
      font-family: Inter, Arial, sans-serif;
    }
    .map-popup {
      color: #0b1020;
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
      color: var(--muted);
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
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
      .hero { grid-template-columns: 1fr; }
      .span-6, .span-7, .span-5, .span-12 { grid-column: span 12; }
    }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <div class="hero-card">
        <div class="eyebrow">RadarEstate</div>
        <h1>Sydney Planning And Activity Research Dashboard</h1>
        <p class="lede">Public-data powered council-level view across housing target pressure, planning proposal pipeline and recent development activity. This report is generated directly from Supabase views, not from mock sample JSON.</p>
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
    const axisColor = '#92a0c4';
    const gridColor = 'rgba(146,160,196,0.12)';

    const ratingColor = (rating, friction) => {
      if ((friction || 0) >= 5) return '#ff6b6b';
      if (rating === 'A') return '#b7ff3c';
      if (rating === 'B') return '#33d1ff';
      return '#ffb547';
    };

    const precinctMap = L.map('precinctMap', { zoomControl: true, scrollWheelZoom: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
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
  const client = await connectWithFallback()
  try {
    const metaPlanning = await client.query(`select count(*)::int as total from public.planning_proposals`)
    const metaApps = await client.query(`select count(*)::int as total from public.application_signals`)
    const metaPrecinct = await client.query(`select count(*)::int as total from public.v_precinct_shortlist`)
    const metaConstraints = await client.query(`select count(*)::int as total from public.constraints`)
    const recentRanking = await client.query(`select council_name, recent_count, total_count from public.v_recent_application_ranking limit 10`)
    const pipeline = await client.query(`select stage, stage_rank, proposal_count from public.v_policy_pipeline order by stage_rank nulls last, stage`)
    const scoreboard = await client.query(`select council_name, target_value, application_recent_count, active_pipeline_count from public.v_council_scoreboard where region_group = 'Greater Sydney' order by active_pipeline_count desc nulls last, made_count desc nulls last limit 12`)
    const scatter = await client.query(`select council_name, target_value, application_recent_count from public.v_target_pressure_vs_activity where target_value is not null and application_recent_count is not null order by target_value desc nulls last`)
    const watchlist = await client.query(`select council_name, stage, title, location_text from public.v_sydney_proposal_watchlist where stage in ('under_assessment','pre_exhibition','on_exhibition','finalisation') order by stage_rank nulls last, last_seen_at desc, title limit 20`)
    const precinctShortlist = await client.query(`select precinct_name, council_name, opportunity_rating, friction_score, recent_application_count, active_pipeline_count, constraint_summary from public.v_precinct_shortlist limit 12`)
    const constrainedPrecincts = await client.query(`select precinct_name, council_name, friction_score, constraint_summary, recent_application_count, active_pipeline_count from public.v_precinct_shortlist where constraint_count > 0 order by friction_score desc, recent_application_count desc limit 12`)
    const precinctMapPoints = await client.query(`select precinct_name, council_name, opportunity_rating, friction_score, recent_application_count, active_pipeline_count, constraint_summary, centroid_latitude, centroid_longitude, point_count from public.v_precinct_map_points`)

    const data = {
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
    const outputPath = path.join(dashboardDir, 'latest-report.html')
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
