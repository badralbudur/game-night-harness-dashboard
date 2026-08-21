const $ = (s) => document.querySelector(s);
const esc = (value) => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const formatTime = (iso) => new Intl.DateTimeFormat('en', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'UTC', timeZoneName:'short'}).format(new Date(iso));

async function init() {
  const data = await fetch('data/dashboard-data.json', {cache: 'no-store'}).then(r => r.json());
  const {project, overview} = data;
  $('#project-name').textContent = project.name;
  $('#project-subtitle').textContent = project.subtitle;
  $('#updated').textContent = `Updated ${formatTime(project.lastUpdated)}`;
  $('#workspace').textContent = project.workspace;
  $('#harness-repo').href = project.harnessRepo;
  $('#deliverable-repo').href = project.deliverableRepo;

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

  $('#timeline').innerHTML = data.runs.map(run => `<article class="run ${run.status}">
    <div class="run-line"><span></span></div><div class="run-body"><p class="run-meta">${esc(run.milestone)} · ${formatTime(run.time)}</p><h3>${esc(run.title)} <em>${esc(run.status)}</em></h3><p>${esc(run.detail)}</p></div>
  </article>`).join('');

  $('#open-items').innerHTML = data.openItems.map(item => `<li><span class="tag ${item.status}">${esc(item.kind)}</span><p>${esc(item.text)}</p></li>`).join('');
  $('#evolution').innerHTML = data.harnessEvolution.map((item, i) => `<li><b>${String(i + 1).padStart(2,'0')}</b><span>${esc(item)}</span></li>`).join('');
}

init().catch(err => { $('#project-name').textContent = 'Dashboard data unavailable'; console.error(err); });
