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
  return JSON.stringify(value).replace(/</g, '\u003c')
}

function opportunityComposite(row) {
  const policy = Number(row.policy_score || 0)
  const timing = Number(row.timing_score || 0)
  const pipeline = Math.min(Number(row.active_pipeline_count || 0), 3)
  return Number((policy * 1.4 + timing + pipeline).toFixed(2))
}

function riskWeight(severity) {
  if (severity === 'high') return 3
  if (severity === 'medium') return 2
  return 1
}

function htmlTemplate(data) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hero Visual Pack</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
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
      const params = new URLSearchParams(window.location.search);
      if (params.get('embedded') === '1') {
        document.documentElement.dataset.embedded = 'true';
      }
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
      --amber: #ffb547;
      --red: #ff6b6b;
      --grid: rgba(146,160,196,0.12);
      --panel-top: rgba(255,255,255,0.03);
      --panel-bottom: rgba(255,255,255,0.01);
      --shadow: rgba(0,0,0,0.18);
      --button-bg: rgba(255,255,255,0.06);
      --button-text: var(--text);
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
      --amber: #d6861b;
      --red: #c94242;
      --grid: rgba(89,112,148,0.16);
      --panel-top: rgba(255,255,255,0.92);
      --panel-bottom: rgba(240,246,255,0.92);
      --shadow: rgba(45,72,117,0.12);
      --button-bg: #ffffff;
      --button-text: #11203f;
    }
    * { box-sizing: border-box; }
    html[data-embedded="true"] .theme-switcher {
      display: none;
    }
    body {
      margin: 0;
      font-family: Inter, Arial, sans-serif;
      background: radial-gradient(circle at top left, var(--bg-accent) 0, var(--bg) 40%);
      color: var(--text);
    }
    .page {
      max-width: 1480px;
      margin: 0 auto;
      padding: 88px 28px 28px;
    }
    html[data-embedded="true"] .page {
      padding: 24px 16px 16px;
      max-width: none;
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
    .theme-switcher-label { color: var(--muted); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
    .theme-switcher-group { display: inline-flex; gap: 6px; padding: 4px; border-radius: 999px; background: var(--panel-2); border: 1px solid var(--line); }
    .theme-switcher-button { appearance: none; border: none; background: transparent; color: var(--muted); border-radius: 999px; padding: 8px 12px; font-size: 12px; font-weight: 700; cursor: pointer; min-width: 68px; }
    .theme-switcher-button[aria-pressed="true"] { background: var(--button-bg); color: var(--button-text); box-shadow: inset 0 0 0 1px var(--line); }
    .hero {
      display: grid;
      grid-template-columns: 1.6fr 1fr;
      gap: 20px;
      margin-bottom: 22px;
    }
    .panel {
      background: linear-gradient(180deg, var(--panel-top), var(--panel-bottom));
      border: 1px solid var(--line);
      border-radius: 20px;
      box-shadow: 0 16px 40px var(--shadow);
      padding: 22px;
    }
    .eyebrow { color: var(--cyan); text-transform: uppercase; letter-spacing: 0.12em; font-size: 12px; margin-bottom: 10px; }
    h1 { margin: 0 0 12px; font-size: 38px; line-height: 1.08; }
    .lede { color: var(--muted); font-size: 15px; line-height: 1.7; margin: 0; }
    .stats { display: grid; gap: 12px; }
    .stat { background: var(--panel-2); border: 1px solid var(--line); border-radius: 16px; padding: 16px; }
    .stat-label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
    .stat-value { font-size: 24px; font-weight: 800; }
    .stat-sub { margin-top: 6px; color: var(--muted); font-size: 13px; line-height: 1.5; }
    .grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 20px; }
    .span-7 { grid-column: span 7; }
    .span-5 { grid-column: span 5; }
    .span-12 { grid-column: span 12; }
    .panel h2 { margin: 0 0 12px; font-size: 20px; }
    .subtle { color: var(--muted); font-size: 13px; line-height: 1.6; margin-bottom: 16px; }
    canvas { width: 100% !important; height: 460px !important; }
    .takeaways { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .takeaway { border: 1px solid var(--line); border-radius: 16px; padding: 16px; background: var(--panel-2); }
    .takeaway h3 { margin: 0 0 8px; font-size: 15px; }
    .takeaway p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.6; }
    .legend { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 12px; color: var(--muted); font-size: 12px; }
    .legend-item { display: inline-flex; align-items: center; gap: 8px; }
    .legend-dot { width: 10px; height: 10px; border-radius: 999px; display: inline-block; }
    @media (max-width: 980px) {
      .page { padding: 92px 18px 18px; }
      .theme-switcher { left: 18px; right: 18px; justify-content: space-between; }
      .hero { grid-template-columns: 1fr; }
      .span-7, .span-5, .span-12 { grid-column: span 12; }
      .takeaways { grid-template-columns: 1fr; }
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
      <div class="panel">
        <div class="eyebrow">RadarEstate</div>
        <h1>Hero Visual Pack</h1>
        <p class="lede">A visual first read of where opportunity still survives after risk adjustment. This is a screening lens for watchlist building, not a parcel-level decision tool.</p>
        <div class="legend">
          <span class="legend-item"><span class="legend-dot" style="background:#b7ff3c"></span>A-rated precinct</span>
          <span class="legend-item"><span class="legend-dot" style="background:#33d1ff"></span>B-rated precinct</span>
          <span class="legend-item"><span class="legend-dot" style="background:#ffb547"></span>C-rated precinct</span>
          <span class="legend-item"><span class="legend-dot" style="background:#ff6b6b"></span>High risk emphasis</span>
        </div>
      </div>
      <div class="stats">
        <div class="stat">
          <div class="stat-label">Strongest Opportunity</div>
          <div class="stat-value">${data.meta.bestOpportunity.precinct_name}</div>
          <div class="stat-sub">${data.meta.bestOpportunity.council_name} · rating ${data.meta.bestOpportunity.opportunity_rating} · derived risk ${data.meta.bestOpportunity.friction_score}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Highest-Frictions</div>
          <div class="stat-value">${data.meta.highestRisk.precinct_name}</div>
          <div class="stat-sub">${data.meta.highestRisk.council_name} · recent apps ${data.meta.highestRisk.recent_application_count} · derived risk ${data.meta.highestRisk.friction_score}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Region Split</div>
          <div class="stat-value">Sydney A:${data.meta.sydney.a_count} / Hunter A:${data.meta.hunter.a_count}</div>
          <div class="stat-sub">Sydney avg friction ${data.meta.sydney.avg_friction}; Hunter avg friction ${data.meta.hunter.avg_friction}</div>
        </div>
      </div>
    </section>

    <section class="grid">
      <div class="panel span-7">
        <h2>Opportunity vs Risk Matrix</h2>
        <p class="subtle">X-axis is an opportunity composite built from policy, timing and active pipeline. Y-axis is friction. Bubble size scales with recent applications.</p>
        <canvas id="matrixChart"></canvas>
      </div>
      <div class="panel span-5">
        <h2>Risk Stack</h2>
        <p class="subtle">Top constrained precincts split by risk component. Bar length reflects weighted severity, not just count.</p>
        <canvas id="riskStackChart"></canvas>
      </div>
      <div class="panel span-12">
        <h2>Key Reads</h2>
        <div class="takeaways">
          ${data.takeaways.map((item) => `
            <div class="takeaway">
              <h3>${item.title}</h3>
              <p>${item.body}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  </div>

  <script>
    const data = ${safeJson(data)};
    const storageKey = 'radarestate-theme';
    const currentTheme = document.documentElement.dataset.theme || 'dark';
    const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const themeButtons = [...document.querySelectorAll('[data-theme-option]')];
    themeButtons.forEach((button) => {
      const theme = button.dataset.themeOption;
      button.setAttribute('aria-pressed', theme === currentTheme ? 'true' : 'false');
      button.addEventListener('click', () => {
        if (theme === currentTheme) return;
        try { window.localStorage.setItem(storageKey, theme); } catch {}
        document.documentElement.dataset.theme = theme;
        window.location.reload();
      });
    });

    const axisColor = cssVar('--muted');
    const gridColor = cssVar('--grid');
    Chart.defaults.color = axisColor;
    Chart.defaults.borderColor = gridColor;
    Chart.defaults.font.family = 'Inter, Arial, sans-serif';

    const ratingColor = (rating) => {
      if (rating === 'A') return '#b7ff3c';
      if (rating === 'B') return '#33d1ff';
      return '#ffb547';
    };

    const avgOpportunity = data.matrix.reduce((sum, row) => sum + row.opportunity, 0) / Math.max(data.matrix.length, 1);
    const avgRisk = data.matrix.reduce((sum, row) => sum + row.risk, 0) / Math.max(data.matrix.length, 1);

    const quadrantPlugin = {
      id: 'quadrantPlugin',
      beforeDatasetsDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        const x = scales.x.getPixelForValue(avgOpportunity);
        const y = scales.y.getPixelForValue(avgRisk);
        ctx.save();
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.moveTo(chartArea.left, y);
        ctx.lineTo(chartArea.right, y);
        ctx.stroke();
        ctx.restore();
      }
    };

    new Chart(document.getElementById('matrixChart'), {
      type: 'bubble',
      data: {
        datasets: [{
          label: 'Precincts',
          data: data.matrix.map((row) => ({
            x: row.opportunity,
            y: row.risk,
            r: row.radius,
            label: row.precinct_name,
            council: row.council_name,
            region: row.region_group,
            rating: row.opportunity_rating,
            recent: row.recent_application_count,
            pipeline: row.active_pipeline_count
          })),
          backgroundColor: data.matrix.map((row) => ratingColor(row.opportunity_rating)),
          borderColor: data.matrix.map((row) => row.risk >= 4 ? '#ff6b6b' : 'rgba(255,255,255,0.24)'),
          borderWidth: data.matrix.map((row) => row.risk >= 4 ? 3 : 1.5)
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                const raw = context.raw;
                return [
                  raw.label + ' (' + raw.council + ')',
                  'Region: ' + raw.region,
                  'Opportunity: ' + raw.x,
                  'Risk: ' + raw.y,
                  'Recent apps: ' + raw.recent,
                  'Pipeline: ' + raw.pipeline,
                  'Rating: ' + raw.rating
                ];
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Opportunity Composite' },
            beginAtZero: true
          },
          y: {
            title: { display: true, text: 'Risk / Friction' },
            beginAtZero: true,
            suggestedMax: 6
          }
        }
      },
      plugins: [quadrantPlugin]
    });

    new Chart(document.getElementById('riskStackChart'), {
      type: 'bar',
      data: {
        labels: data.riskStack.labels,
        datasets: data.riskStack.datasets.map((dataset) => ({
          ...dataset,
          borderRadius: 6,
          borderSkipped: false
        }))
      },
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        },
        scales: {
          x: {
            stacked: true,
            beginAtZero: true,
            title: { display: true, text: 'Weighted Risk Load' }
          },
          y: {
            stacked: true
          }
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
    const regionSummary = await client.query(`
      with shortlist as (
        select c.region_group,
               count(*)::int as shortlist_items,
               count(*) filter (where v.opportunity_rating='A')::int as a_count,
               count(*) filter (where v.opportunity_rating='B')::int as b_count,
               count(*) filter (where v.opportunity_rating='C')::int as c_count,
               avg(v.friction_score)::numeric(10,2) as avg_friction
        from public.v_precinct_shortlist v
        join public.councils c on c.canonical_name = v.council_name
        group by c.region_group
      )
      select * from shortlist order by region_group
    `)

    const matrixRows = await client.query(`
      select v.precinct_name, v.council_name, c.region_group, v.opportunity_rating, v.policy_score,
             v.timing_score, v.friction_score, v.recent_application_count, v.active_pipeline_count
      from public.v_precinct_shortlist v
      join public.councils c on c.canonical_name = v.council_name
      order by case v.opportunity_rating when 'A' then 1 when 'B' then 2 else 3 end,
               v.friction_score asc nulls last,
               v.recent_application_count desc nulls last
      limit 30
    `)

    const riskRows = await client.query(`
      select v.precinct_name, c.constraint_type, c.severity
      from public.constraints c
      join public.precincts p on p.id = c.precinct_id
      join public.v_precinct_shortlist v on v.precinct_id = p.id
      where v.constraint_count > 0
      order by v.friction_score desc, v.recent_application_count desc, v.precinct_name
    `)

    const strongest = await client.query(`
      select precinct_name, council_name, opportunity_rating, friction_score
      from public.v_precinct_shortlist
      order by case opportunity_rating when 'A' then 1 when 'B' then 2 else 3 end,
               friction_score asc nulls last,
               recent_application_count desc nulls last
      limit 1
    `)

    const highestRisk = await client.query(`
      select precinct_name, council_name, opportunity_rating, friction_score, recent_application_count
      from public.v_precinct_shortlist
      where constraint_count > 0
      order by friction_score desc, recent_application_count desc
      limit 1
    `)

    const summaryMap = Object.fromEntries(regionSummary.rows.map((row) => [row.region_group, row]))

    const matrix = matrixRows.rows.map((row) => {
      const recent = Number(row.recent_application_count || 0)
      return {
        ...row,
        opportunity: opportunityComposite(row),
        risk: Number(row.friction_score || 0),
        radius: Math.max(6, Math.min(22, 6 + Math.sqrt(recent) * 0.5))
      }
    })

    const topRiskPrecincts = [...new Set(riskRows.rows.map((row) => row.precinct_name))].slice(0, 10)
    const riskTypes = [
      { key: 'flood_metadata_signal', label: 'Flood', color: '#ff5daa' },
      { key: 'bushfire_spatial_sample', label: 'Bushfire', color: '#ff6b6b' },
      { key: 'low_tree_canopy_proxy', label: 'Low Canopy', color: '#ffb547' },
      { key: 'heat_vulnerability_proxy', label: 'Heat', color: '#ffcf5a' },
      { key: 'biodiversity_spatial_sample', label: 'Biodiversity', color: '#7ed957' },
      { key: 'policy_withdrawal_friction', label: 'Withdrawal', color: '#8b7bff' }
    ]

    const riskMatrixMap = new Map()
    for (const row of riskRows.rows) {
      if (!topRiskPrecincts.includes(row.precinct_name)) continue
      const entry = riskMatrixMap.get(row.precinct_name) || {}
      entry[row.constraint_type] = (entry[row.constraint_type] || 0) + riskWeight(row.severity)
      riskMatrixMap.set(row.precinct_name, entry)
    }

    const riskStack = {
      labels: topRiskPrecincts,
      datasets: riskTypes.map((type) => ({
        label: type.label,
        backgroundColor: type.color,
        data: topRiskPrecincts.map((precinct) => riskMatrixMap.get(precinct)?.[type.key] || 0)
      }))
    }

    const takeaways = [
      {
        title: 'Leaders are selective, not noisy',
        body: `${strongest.rows[0].precinct_name} currently leads because opportunity is high while friction remains low. This is very different from simply ranking by application volume.`
      },
      {
        title: 'Risk is rewriting the shortlist',
        body: `${highestRisk.rows[0].precinct_name} shows how a busy precinct can still become cautionary once flood, bushfire or process friction start stacking together.`
      },
      {
        title: 'Sydney and Hunter are different markets',
        body: `Sydney currently has ${summaryMap['Greater Sydney'].a_count} A-rated precincts, while Hunter has ${summaryMap['Hunter'].a_count}. Hunter is viable, but it behaves more like a watchlist market than a clean conviction market.`
      },
      {
        title: 'Flood and bushfire dominate current risk',
        body: `The current stack is being shaped much more by flood metadata and bushfire spatial hits than by biodiversity. That is where ranking changes are happening most often.`
      }
    ]

    const data = {
      meta: {
        bestOpportunity: strongest.rows[0],
        highestRisk: highestRisk.rows[0],
        sydney: summaryMap['Greater Sydney'],
        hunter: summaryMap['Hunter']
      },
      matrix,
      riskStack,
      takeaways
    }

    const outPath = path.join(root, 'dashboard', 'hero-visual-pack.html')
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, htmlTemplate(data), 'utf8')
    console.log(`Wrote ${outPath}`)
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
