const $ = (s) => document.querySelector(s);
const esc = (value) => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const formatTime = (iso) => new Intl.DateTimeFormat('en', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'UTC', timeZoneName:'short'}).format(new Date(iso));
const formatDate = (iso) => new Intl.DateTimeFormat('en', {month:'short', day:'numeric', timeZone:'UTC'}).format(new Date(iso));

function renderTimeline(runs) {
  const viewport = $('#timeline-viewport');
  const track = $('#timeline');
  const detail = $('#timeline-detail');
  const zoom = $('#timeline-zoom');
  let scale = Number(zoom.value);
  const minScale = Number(zoom.min);
  const maxScale = Number(zoom.max);
  const step = Number(zoom.step);

  const updateWidth = () => {
    track.style.width = `${Math.max(360, runs.length * 150 * scale)}px`;
    track.dataset.zoom = scale;
  };
  const priorCard = (run) => `<article class="prior-run ${esc(run.status)}"><p>${formatTime(run.time)} · ${esc(run.milestone)}</p><h4>${esc(run.title)}</h4><span>${esc(run.detail)}</span></article>`;
  const showDetail = (index, marker) => {
    const run = runs[index];
    track.querySelectorAll('.run-marker').forEach(n => n.classList.remove('selected'));
    marker.classList.add('selected');
    const previous = runs.slice(Math.max(0, index - 2), index).reverse();
    detail.innerHTML = `<p class="eyebrow">SELECTED RUN · ${formatTime(run.time)} · ${esc(run.milestone)}</p><h3>${esc(run.title)} <em class="${esc(run.status)}">${esc(run.status)}</em></h3><p>${esc(run.detail)}</p>${previous.length ? `<div class="previous-runs"><p class="eyebrow">PREVIOUS ${previous.length === 1 ? 'RUN' : 'TWO RUNS'}</p>${previous.map(priorCard).join('')}</div>` : ''}`;
  };

  track.innerHTML = runs.map((run, index) => `<button class="run-marker ${esc(run.status)}" data-index="${index}" style="left:${((index + .5) / runs.length) * 100}%" aria-label="${esc(run.title)}: ${esc(run.status)}"><span>${String(index + 1).padStart(2, '0')}</span><b>${esc(run.milestone)}</b><time>${formatDate(run.time)}</time></button>`).join('');
  track.querySelectorAll('.run-marker').forEach(marker => marker.addEventListener('click', () => showDetail(Number(marker.dataset.index), marker)));
  updateWidth();

  const setZoom = (next) => {
    scale = Math.max(minScale, Math.min(maxScale, Math.round(next / step) * step));
    zoom.value = scale;
    updateWidth();
  };
  $('#zoom-in').addEventListener('click', () => setZoom(scale + step));
  $('#zoom-out').addEventListener('click', () => setZoom(scale - step));
  zoom.addEventListener('input', () => setZoom(Number(zoom.value)));
  viewport.addEventListener('wheel', event => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setZoom(scale + (event.deltaY < 0 ? step : -step));
  }, {passive: false});

  if (runs.length) showDetail(runs.length - 1, track.querySelector(`[data-index="${runs.length - 1}"]`));
}

async function init() {
  const data = await fetch('data/dashboard-data.json', {cache: 'no-store'}).then(r => r.json());
  const {project, overview, checkpoint} = data;
  $('#project-name').textContent = project.name;
  $('#project-subtitle').textContent = project.subtitle;
  $('#updated').textContent = `Updated ${formatTime(project.lastUpdated)}`;
  $('#workspace').textContent = project.workspace;
  $('#harness-repo').href = project.harnessRepo;
  $('#deliverable-repo').href = project.deliverableRepo;
  $('#checkpoint-headline').textContent = checkpoint.headline;
  $('#where-we-are').textContent = checkpoint.whereWeAre;
  $('#where-we-go').textContent = checkpoint.whereWeGo;
  $('#next-action').textContent = checkpoint.nextAction;

  const passed = overview.completedMilestones.length;
  $('#metrics').innerHTML = [
    ['CURRENT', `${overview.currentMilestone}`, overview.currentMilestoneTitle],
    ['PROGRESS', `${passed}/${overview.totalMilestones}`, 'milestones approved'],
    ['RUN MODE', overview.retryMode.startsWith('Automatic') ? 'AUTO' : 'MANUAL', overview.retryMode],
    ['WORKSPACE', overview.workspaceStatus === 'Needs operator review' ? 'REVIEW' : 'READY', overview.workspaceStatus]
  ].map(([label, value, note]) => `<article class="metric panel"><p>${esc(label)}</p><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`).join('');

  $('#milestones').innerHTML = data.milestones.map((m, i) => `<li class="milestone ${m.status}">
    <span class="dot">${m.status === 'passed' ? '✓' : String(i + 1).padStart(2,'0')}</span>
    <div><h3>${esc(m.id)} <span>${esc(m.title)}</span></h3><p>${esc(m.detail)}</p></div>
    <b>${esc(m.status)}</b>
  </li>`).join('');

  renderTimeline(data.runs);
  $('#open-items').innerHTML = data.openItems.map(item => `<li><span class="tag ${item.status}">${esc(item.kind)}</span><p>${esc(item.text)}</p></li>`).join('');
  $('#evolution').innerHTML = data.harnessEvolution.map((item, i) => `<li><b>${String(i + 1).padStart(2,'0')}</b><span>${esc(item)}</span></li>`).join('');
}

init().catch(err => { $('#project-name').textContent = 'Dashboard data unavailable'; console.error(err); });
