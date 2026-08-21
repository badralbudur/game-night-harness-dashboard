const $ = (s) => document.querySelector(s);
const esc = (value) => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const formatTime = (iso) => new Intl.DateTimeFormat('en', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'UTC', timeZoneName:'short'}).format(new Date(iso));

function renderTimeline(runs) {
  const viewport = $('#timeline-viewport');
  const track = $('#timeline');
  const detail = $('#timeline-detail');
  const zoom = $('#timeline-zoom');
  let scale = Number(zoom.value);

  const updateWidth = () => {
    track.style.width = `${Math.max(620, runs.length * 180 * scale)}px`;
    track.dataset.zoom = scale;
  };
  const showDetail = (run, marker) => {
    track.querySelectorAll('.run-marker').forEach(n => n.classList.remove('selected'));
    marker.classList.add('selected');
    detail.innerHTML = `<p class="eyebrow">${esc(run.milestone)} · ${formatTime(run.time)}</p><h3>${esc(run.title)} <em class="${esc(run.status)}">${esc(run.status)}</em></h3><p>${esc(run.detail)}</p>`;
  };

  track.innerHTML = runs.map((run, index) => `<button class="run-marker ${esc(run.status)}" data-index="${index}" style="left:${((index + .5) / runs.length) * 100}%" aria-label="${esc(run.title)}: ${esc(run.status)}"><span>${String(index + 1).padStart(2, '0')}</span><b>${esc(run.milestone)}</b></button>`).join('');
  track.querySelectorAll('.run-marker').forEach(marker => marker.addEventListener('click', () => showDetail(runs[Number(marker.dataset.index)], marker)));
  updateWidth();

  const setZoom = (next) => {
    scale = Math.max(1, Math.min(5, next));
    zoom.value = scale;
    updateWidth();
  };
  $('#zoom-in').addEventListener('click', () => setZoom(scale + 1));
  $('#zoom-out').addEventListener('click', () => setZoom(scale - 1));
  zoom.addEventListener('input', () => setZoom(Number(zoom.value)));
  viewport.addEventListener('wheel', event => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setZoom(scale + (event.deltaY < 0 ? 1 : -1));
  }, {passive: false});

  if (runs.length) showDetail(runs[runs.length - 1], track.querySelector(`[data-index="${runs.length - 1}"]`));
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
    ['RUN MODE', 'MANUAL', overview.retryMode],
    ['WORKSPACE', 'READY', overview.workspaceStatus]
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
