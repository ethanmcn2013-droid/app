(() => {
  'use strict';
  const f = window.signalFixture;
  const q = new URLSearchParams(location.search);
  const states = ['connected','not-connected','setting-up','access-attention','handover','resources','uploading','unavailable'];
  const names = {a:'Custodian',b:'Ledger',c:'Threshold'};
  const state = states.includes(q.get('state')) ? q.get('state') : 'connected';
  const variant = ['a','b','c'].includes(q.get('v')) ? q.get('v') : 'a';
  document.body.dataset.state = state;
  document.body.dataset.v = variant;
  document.body.dataset.embed = String(q.get('embed') === '1');

  const icons = {
    home:'⌂', notes:'▤', tasks:'✓', timeline:'⌁', more:'⌘', search:'⌕', attach:'⌁', arrow:'→', check:'✓', close:'×'
  };
  const initials = (person, tone='') => `<span class="avatar ${tone}">${person.initials}</span>`;
  const statusPill = (label, type='', dot='') => `<span class="status-pill ${type}">${dot ? `<i class="tiny-dot ${dot}"></i>` : ''}${label}</span>`;
  const directionClass = `direction-${variant}`;

  function topShell(inner) {
    return `<div class="app">
      <header class="topbar">
        <div class="home-mark">⌂</div><div class="brand">tasks<span class="brand-dot"></span></div>
        <div class="topbar-spacer"></div><div class="search">⌕&nbsp; Search <span class="key">Ctrl K</span></div>
        <button class="top-add">＋ <span class="full">Add task</span></button>
      </header>
      <div class="body-grid">
        <aside class="suite-rail">
          <div class="suite-item"><span class="suite-icon">▤</span><span>Notes</span></div>
          <div class="suite-item active"><span class="suite-icon">✓</span><span>Tasks</span></div>
          <div class="suite-item"><span class="suite-icon">⌁</span><span>Timeline</span></div>
          <div class="suite-item"><span class="suite-icon">⌘</span><span>More</span></div>
          <div class="suite-bottom"><div class="user-orb">EO</div></div>
        </aside>
        <aside class="project-rail">
          <div class="project-rail-head"><span>Projects</span><span>⌄</span></div>
          <div class="project-list">
            <div class="project-link">⌂ <span>Home</span></div><div class="project-link">⌄ <span>Inbox</span><span class="count">8</span></div>
            <div class="project-link">☷ <span>My work</span></div><div class="project-link folder-label">Project folders</div>
            <div class="project-link selected"><span>Glenmara House</span><span class="count">13</span></div><div class="project-link">＋ <span>Add project</span></div>
          </div>
        </aside>
        <main class="workspace">
          <header class="project-head"><div class="project-title-row"><h1 class="project-title">Glenmara House, events</h1><div class="head-actions"><button class="ghost-btn">⌁&nbsp; Share</button><button class="ghost-btn">•••</button></div></div>
            <nav class="project-tabs"><button class="project-tab active">Board</button><button class="project-tab">List</button><button class="project-tab">Schedule</button><button class="project-tab">Calendar</button></nav>
          </header>
          ${inner}
        </main>
      </div>
      <a class="lab-stamp" href="compare.html?state=${state}">${variant.toUpperCase()} / ${names[variant]} · ${state.replaceAll('-',' ')}</a>
    </div>`;
  }

  const navItems = ['Workspace','Members','Notifications','Appearance','Security','Connections','Billing','Privacy and data','Danger zone'];
  function settingsFrame(content) {
    return `<section class="settings-stage"><div class="settings-wrap">
      <aside class="settings-local"><h2 class="settings-nav-title">Settings</h2><nav class="settings-nav">
        ${navItems.map((item,i)=>`<div class="settings-nav-item ${item==='Connections'?'active':''} ${item==='Danger zone'?'danger':''}"><span class="nav-index">${String(i+1).padStart(2,'0')}</span><span>${item}</span></div>`).join('')}
      </nav><div class="save-note">Changes save the moment you make them. No save button, we don’t do save buttons here.</div></aside>
      <section class="settings-main"><header class="surface-head"><p class="eyebrow">Connections</p><h1>Board files</h1><p>Choose where this board keeps new files, and see who can open them now.</p></header>${content}</section>
    </div></section>`;
  }

  function ownerCard({action=true, compact=false}={}) {
    return `<section class="card a-owner"><div class="a-owner-top">${initials(f.owner)}<div class="a-owner-copy"><span class="kicker">Storage owner</span><h2>${f.owner.name}</h2><p>New files go to Orla’s Google Drive.</p></div>${action?'<button class="soft-btn">Change owner</button>':''}</div>
      <div class="a-folder"><span class="drive-mark">△</span><div class="a-folder-copy"><strong>${f.board}</strong><span>${f.folder}</span></div>${statusPill('Connected','accent','')}</div></section>`;
  }

  function personRows(mode='connected') {
    return f.people.map((p,i)=>{
      let label='Can edit', small='Confirmed by Google';
      if(mode==='setting-up' && i>1){ label=i===2?'Can edit':'Setting up'; small=i===2?'Confirmed by Google':'This can take a moment'; }
      if(mode==='attention' && i===3){label='Waiting';small='We’ll try again';}
      if(mode==='attention' && i===4){label='Removing';small='Not confirmed yet';}
      const tone=(label==='Can edit')?'soft':'';
      return `<div class="person-row">${initials(p,tone)}<div class="person-name"><strong>${p.name}</strong><span>${p.email} · ${p.role}</span></div><div class="person-state"><span>${label}</span><small>${small}</small></div></div>`;
    }).join('');
  }

  function accessCard(mode='connected') {
    const message=mode==='setting-up'?'3 of 5 people are ready':mode==='attention'?'2 access changes need attention':'5 people confirmed';
    return `<section class="card"><header class="access-card-head"><div><h3>Who can open this board’s files</h3><p>Live access from Google, not just board membership.</p></div><span class="meta checked">${message} · ${f.now}</span></header><div class="people">${personRows(mode)}</div></section>`;
  }

  function settingsA(s) {
    if(s==='not-connected') return `<div class="a-stack"><section class="card a-empty"><span class="drive-mark">△</span><h2>Keep new board files in your Drive</h2><p>Connect Google Drive once. You can keep attaching files through Signal Studio until then.</p><button class="primary-btn">Connect Google Drive</button></section><div class="quiet-callout"><strong>What stays the same?</strong> Tasks keep one Attach button. Existing files stay where they are.</div></div>`;
    if(s==='setting-up') return `<div class="a-stack">${ownerCard({action:false})}<section class="card"><header class="access-card-head"><div><h3>Getting this board ready</h3><p>You can close Settings. We’ll finish here.</p></div>${statusPill('Setting up','accent')}</header><div class="setup-list"><div class="setup-step"><i class="tiny-dot ink"></i><div class="step-copy"><strong>Board folder created</strong><span>${f.folder}</span></div>${icons.check}</div><div class="setup-step"><span class="spinner"></span><div class="step-copy"><strong>Giving the team access</strong><span>Mara, Finn and Northlight are next</span></div><span class="meta">3 of 5</span></div></div></section>${accessCard('setting-up')}</div>`;
    if(s==='access-attention') return `<div class="a-stack">${ownerCard()}<div class="attention-callout"><span class="attention-icon">!</span><div class="attention-copy"><strong>Two people do not match the board yet</strong><p>Finn is waiting for access. Northlight’s old access has not been removed by Google.</p></div><button class="soft-btn">Try again</button></div>${accessCard('attention')}</div>`;
    if(s==='handover') return `<div class="a-stack">${ownerCard({action:false})}<section class="card handover-card"><p class="eyebrow">Change storage owner</p><h2>Assign new files to Maeve’s Drive?</h2><div class="handover-people"><div class="handover-person">${initials(f.owner,'soft')}<div><strong>${f.owner.name}</strong><span>Current owner</span></div></div><span class="handover-arrow">→</span><div class="handover-person to"><div><strong>${f.nextOwner.name}</strong><span>New owner</span></div>${initials(f.nextOwner)}</div></div><ul class="consequence-list"><li>Existing files stay in Orla’s Drive.</li><li>New files will go to a new folder in Maeve’s Drive.</li><li>Attaching pauses while the new folder is prepared.</li><li>Everyone keeps their current access.</li></ul><div class="button-row"><button class="primary-btn secondary">Cancel</button><button class="primary-btn">Assign storage to Maeve</button></div></section></div>`;
    return `<div class="a-stack">${ownerCard()}${accessCard('connected')}<div class="quiet-callout">Disconnecting or changing owner never moves or deletes existing files. We’ll show the consequences before you confirm.</div></div>`;
  }

  function bSummary(status='Connected') {
    return `<div class="b-summary"><div class="b-fact"><label>Storage owner</label><strong>${f.owner.name}</strong><span>${f.owner.email}</span></div><div class="b-fact"><label>Board folder</label><strong>${status}</strong><span>${f.board}</span></div><div class="b-fact"><label>Last checked</label><strong>Google · 10:24</strong><span>3 September 2026</span></div></div>`;
  }
  function bTable(mode='connected') {
    return `<table class="b-table"><colgroup><col style="width:43%"><col style="width:18%"><col style="width:22%"><col style="width:17%"></colgroup><thead><tr><th>Person</th><th>Board role</th><th>Google access</th><th>Evidence</th></tr></thead><tbody>${f.people.map((p,i)=>{
      let access='Can edit',evidence='Confirmed'; if(mode==='setting-up'&&i>1){access=i===2?'Can edit':'Setting up';evidence=i===2?'Confirmed':'Waiting';} if(mode==='attention'&&i===3){access='Waiting';evidence='Retry due';} if(mode==='attention'&&i===4){access='Removing';evidence='Unconfirmed';}
      return `<tr><td><div class="b-person">${initials(p,i===0?'mono':'soft')}<div><strong>${p.name}</strong><span>${p.email}</span></div></div></td><td>${p.role}</td><td><span class="b-status"><i class="tiny-dot ${access==='Can edit'?'ink':'ring'}"></i>${access}</span></td><td class="mono">${evidence}</td></tr>`}).join('')}</tbody></table>`;
  }
  function settingsB(s) {
    if(s==='not-connected') return `<section class="b-ledger"><div class="b-empty-row"><span class="drive-mark">△</span><div class="copy"><h2>No Drive connection</h2><p>New attachments currently use Signal Studio storage.</p></div><button class="primary-btn">Connect Google Drive</button></div><div class="b-note"><span class="mono">NOTE</span><span>Connecting changes where future files are stored. It does not move existing files.</span></div></section>`;
    if(s==='handover') return `<section class="b-ledger">${bSummary('Connected')}<div class="b-toolbar"><h3>Storage-owner change</h3>${statusPill('Confirmation required','outline')}</div><div class="b-handover"><div class="b-handover-line"><label>From</label><p><strong>Orla Byrne</strong> · Existing files stay in Orla’s Drive.</p></div><div class="b-handover-line"><label>To</label><p><strong>Maeve Kelly</strong> · future files go to a new folder in Maeve’s Drive</p></div><div class="b-handover-line"><label>During change</label><p>Attaching pauses during the change. Current Google access remains in place.</p></div></div><div class="b-actions"><button class="primary-btn secondary">Cancel</button><button class="primary-btn">Assign to Maeve</button></div></section>`;
    const mode=s==='access-attention'?'attention':s==='setting-up'?'setting-up':'connected';
    return `<section class="b-ledger">${bSummary(s==='setting-up'?'Setting up':'Connected')}${s==='setting-up'?'<div class="b-progress"><div class="b-progress-line"><strong>Giving the team access</strong><span class="mono meta">3 / 5</span></div><div class="progress-track"><div class="progress-fill" style="width:60%"></div></div></div>':''}${s==='access-attention'?'<div class="attention-callout" style="margin:16px 0"><span class="attention-icon">2</span><div class="attention-copy"><strong>Two rows need attention</strong><p>The ledger keeps Google’s live result separate from board role.</p></div><button class="soft-btn">Try again</button></div>':''}<div class="b-toolbar"><h3>Who can open this board’s files</h3><span class="meta">${f.people.length} people · live from Google</span></div>${bTable(mode)}<div class="b-note"><span class="mono">RULE</span><span>Board role and Google access are shown separately because one does not prove the other.</span></div></section>`;
  }

  function cRail(current=2) {
    const steps=[['01','Choose a custodian'],['02','Keep access true'],['03','Attach as usual']];
    return `<aside class="c-rail">${steps.map((x,i)=>`<div class="c-step ${i+1<current?'done':''} ${i+1===current?'current':''}"><strong>${x[0]} · ${x[1]}</strong><span>${i===0?'One accountable Drive':i===1?'Checked with Google':'One familiar control'}</span></div>`).join('')}</aside>`;
  }
  function cOwner() {
    return `<section class="c-hero"><p class="eyebrow">This board’s file custodian</p><div class="c-owner-row">${initials(f.owner)}<div><h2>${f.owner.name}</h2><p>New files settle in Orla’s Google Drive.</p></div></div><div class="c-hero-note"><strong>${f.board}</strong><span>Connected · checked 10:24</span></div></section>`;
  }
  function cPeople(mode='connected') {
    return `<section class="c-panel"><header class="c-panel-head"><h3>Who can open this board’s files</h3><span class="meta">Live from Google</span></header>${f.people.map((p,i)=>{let status='Can edit';if(mode==='setup'&&i>1)status=i===2?'Can edit':'Setting up';if(mode==='attention'&&i===3)status='Waiting';if(mode==='attention'&&i===4)status='Removing';return `<div class="c-person">${initials(p,'soft')}<div class="person-name"><strong>${p.name}</strong><span>${p.role}</span></div>${statusPill(status,status==='Can edit'?'':'outline',status==='Can edit'?'ink':'ring')}</div>`}).join('')}</section>`;
  }
  function settingsC(s) {
    if(s==='not-connected') return `<div class="c-shell">${cRail(1)}<div class="c-content"><section class="c-transition"><span class="drive-mark">△</span><h2 style="margin-top:18px">Choose where new files settle</h2><p>Connect Google Drive and this board will have one clear file custodian. You can still attach through Signal Studio without it.</p><div class="quiet-callout" style="margin:20px 0">Tasks keep one Attach button. Existing files stay where they are.</div><button class="primary-btn">Connect Google Drive</button></section></div></div>`;
    if(s==='handover') return `<div class="c-shell">${cRail(1)}<div class="c-content"><section class="c-transition"><p class="eyebrow">A change of custodian</p><h2>Pass future files from Orla to Maeve</h2><p>The line changes here. The files already on either side do not move.</p><div class="c-transfer-track"><div class="c-transfer-person">${initials(f.owner,'soft')}<span>Orla</span></div><span class="c-transfer-marker">future files</span><div class="c-transfer-person">${initials(f.nextOwner)}<span>Maeve</span></div></div><ul class="consequence-list"><li>Existing files stay in Orla’s Drive.</li><li>Maeve gets a new board folder.</li><li>Attaching pauses until the new folder is ready.</li></ul><div class="button-row"><button class="primary-btn secondary">Keep Orla</button><button class="primary-btn">Assign to Maeve</button></div></section></div></div>`;
    const mode=s==='setting-up'?'setup':s==='access-attention'?'attention':'connected';
    return `<div class="c-shell">${cRail(s==='setting-up'||s==='access-attention'?2:3)}<div class="c-content">${cOwner()}${s==='setting-up'?'<div class="quiet-callout" style="margin-top:12px"><strong>Giving the team access · 3 of 5</strong><div class="progress-track" style="margin-top:10px"><div class="progress-fill" style="width:60%"></div></div></div>':''}${s==='access-attention'?'<div class="attention-callout" style="margin-top:12px"><span class="attention-icon">!</span><div class="attention-copy"><strong>The board and Google do not match yet</strong><p>Finn is waiting. Northlight’s removal is not confirmed.</p></div><button class="soft-btn">Try again</button></div>':''}${cPeople(mode)}</div></div>`;
  }

  function renderSettings() {
    const content=variant==='a'?settingsA(state):variant==='b'?settingsB(state):settingsC(state);
    return topShell(settingsFrame(content));
  }

  function fileRow(file, index, isNew=false) {
    if(variant==='b') return `<div class="resource-row ${isNew?'is-new':''}"><span class="file-icon">${file.kind}</span><div class="file-copy"><strong>${file.name}</strong><span>${file.meta}</span></div><span class="file-origin">${file.source}</span><span class="access-word">Board access</span><button class="file-more">•••</button></div>`;
    return `<div class="resource-row ${isNew?'is-new':''}"><span class="file-icon">${file.kind}</span><div class="file-copy"><strong>${file.name}</strong><span>${file.meta}${variant==='a'?` · In ${file.source}`:''}</span></div>${variant==='c'?`<span class="file-origin">${file.source}</span>`:''}<button class="file-more">•••</button></div>`;
  }
  function resourcesBlock() {
    const resourcesClass=`resources ${directionClass}`;
    const intro=variant==='c'?`<div class="destination-strip"><span class="tiny-dot"></span><span>New files settle in <strong>Orla’s Drive</strong></span></div>`:'';
    const ledgerHead=variant==='b'?`<div class="resource-ledger-head"><span>File</span><span>Stored in</span><span>Opens for</span></div>`:'';
    const files=state==='uploading'?f.files.slice(0,2):f.files;
    const upload=state==='uploading'?`<div class="upload-row"><div class="upload-top"><span class="file-icon">pdf</span><div class="file-copy"><strong>${f.upload.name}</strong><span>${f.upload.size} · Going straight to Orla’s Drive</span></div><button class="cancel-upload">Cancel</button></div><div class="progress-track"><div class="progress-fill" style="width:${f.upload.progress}%"></div></div></div>`:'';
    const fallback=state==='unavailable'?`<div class="fallback"><span class="attention-icon">i</span><div><strong>This file will use Signal Studio</strong><p>Orla’s Drive is full or needs attention. Existing files stay where they are, and this upload can continue here.</p></div></div>`:'';
    return `<section class="${resourcesClass}"><header class="resources-head"><h2 class="section-label">Resources</h2><button class="attach">⌁&nbsp; Attach</button></header>${intro}${fallback}${upload}${ledgerHead}<div class="resource-list">${files.map((file,i)=>fileRow(file,i,state==='resources'&&variant==='c'&&i===0)).join('')}</div><div class="drop-zone">⌁ <span>Drop files here, or paste a link…</span></div></section>`;
  }
  function taskScene() {
    return `<section class="board-scene"><div class="board-ghost"><div class="ghost-column"><div class="ghost-card"></div><div class="ghost-card"></div></div><div class="ghost-column"><div class="ghost-card"></div></div><div class="ghost-column"><div class="ghost-card"></div></div></div><div class="modal-veil"><article class="task-modal">
      <header class="task-modal-head"><div class="crumbs">${f.venue}<span>/</span><span>T-18</span><span style="margin-left:auto">⌃ &nbsp;&nbsp; ⌄ &nbsp;&nbsp; ••• &nbsp;&nbsp; ×</span></div><div class="task-title-row"><h1>Confirm final room plan and supplier timings</h1><div class="task-chips"><span class="task-chip">To do</span><span class="task-chip">${initials(f.owner)} Orla</span><span class="task-chip">19 Sep</span><button class="primary-btn">✓ Mark done</button></div></div></header>
      <div class="task-modal-body"><div class="task-main"><section class="description"><h2 class="section-label">Description</h2><p>Mara & Finn, Saturday. Finalise the room plan and make sure every supplier has the latest arrival time.</p></section><div class="subtask">＋ &nbsp; Add subtask</div>${resourcesBlock()}<section class="conversation"><h2 class="section-label">Conversation</h2><p>No conversation yet.<br>Comments and changes will appear here as they happen.</p></section></div>
      <aside class="task-aside"><div class="aside-field"><h3 class="section-label">Repeats</h3><span class="tag">↻ Doesn’t repeat</span></div><div class="aside-field"><h3 class="section-label">Tags</h3><strong>Mara & Finn</strong></div><div class="aside-field"><h3 class="section-label">Contact</h3><span class="tag">Mara Doyle</span></div><div class="aside-field"><h3 class="section-label">Project</h3><strong>${f.venue}</strong></div><div class="aside-field"><h3 class="section-label">Due</h3><strong>19 September</strong><span>16 days away</span></div></aside></div>
    </article></div></section>`;
  }

  const isResource=['resources','uploading','unavailable'].includes(state);
  document.getElementById('experience').innerHTML=isResource?topShell(taskScene()):renderSettings();
  requestAnimationFrame(()=>{
    window.scrollTo(0,0);
    document.querySelectorAll('.settings-stage,.task-modal').forEach(element=>{element.scrollTop=0});
    const nav=document.querySelector('.settings-nav');
    const active=nav?.querySelector('.active');
    if(nav&&active&&matchMedia('(max-width:760px)').matches){nav.scrollLeft=Math.max(0,active.offsetLeft-(innerWidth-active.offsetWidth)/2)}
  });
})();
