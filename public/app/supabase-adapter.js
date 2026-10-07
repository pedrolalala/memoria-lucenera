/*
 * Camada de persistência Supabase do Memória Perene.
 * Carregada depois de app.js para manter a demonstração local e tornar
 * todos os cadastros autenticados persistentes no Supabase com RLS.
 */

const remoteTables = [
  'entities', 'knowledge_items', 'experiences', 'decisions', 'projects',
  'sources', 'relations', 'citations', 'files', 'record_versions', 'inbox_items'
];

const optionalRemoteTables = [
  'memory_organization_rules', 'memory_organization_feedback',
  'memory_organization_rule_evidence', 'memory_organization_rule_versions',
  'memory_organization_settings', 'memory_organization_conflicts',
  'document_ingestion_runs', 'document_sections'
];

const allowedUploadTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'text/csv', 'text/markdown', 'application/rtf', 'text/rtf', 'image/jpeg', 'image/png', 'image/webp',
  'audio/mpeg', 'audio/wav', 'audio/webm',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

function isRemoteUser() {
  return Boolean(sb && user?.id && user.id !== 'demo-user');
}

window.persist = function persistSupabaseAware() {
  if (!isRemoteUser()) localStorage.setItem('memoria-perene', JSON.stringify(db));
};

function initializeEmptyDb() {
  db = {};
  [...remoteTables, ...optionalRemoteTables].forEach(table => { db[table] = []; });
  db.domains = [];
  db.document_sections = [];
}

async function loadRemoteDatabase() {
  initializeEmptyDb();
  const results = await Promise.all(remoteTables.map(async table => {
    const { data, error } = await sb.from(table).select('*');
    if (error) throw new Error(`Falha ao carregar ${labels[table] || table}: ${error.message}`);
    return [table, data || []];
  }));
  results.forEach(([table, rows]) => { db[table] = rows; });
  const optionalResults = await Promise.all(optionalRemoteTables.map(async table => {
    const { data, error } = await sb.from(table).select('*');
    if (error) return [table, [], false];
    return [table, data || [], true];
  }));
  optionalResults.forEach(([table, rows]) => { db[table] = rows; });
  window.memoryOrganizationAvailable = optionalResults.filter(([table]) => table.startsWith('memory_organization_')).every(([, , available]) => available);
  window.longDocumentIngestionAvailable = optionalResults
    .filter(([table]) => ['document_ingestion_runs', 'document_sections'].includes(table))
    .every(([, , available]) => available);
  if (window.memoryOrganizationAvailable) await window.MemoryOrganizationService?.ensureDefaults();
}

window.init = async function initSupabaseAware() {
  if (!isRemoteUser()) {
    const saved = localStorage.getItem('memoria-perene');
    if (saved) db = JSON.parse(saved);
    else {
      db = {};
      Object.entries(seed).forEach(([table, rows]) => { db[table] = rows.map(row => fromSeed(table, row)); });
      db.relations = []; db.files = []; db.record_versions = []; db.citations = [];
    }
    Object.keys(fields).forEach(table => { db[table] ??= []; });
    db.inbox_items ??= []; db.relations ??= []; db.files ??= []; db.record_versions ??= []; db.citations ??= [];
    optionalRemoteTables.forEach(table => { db[table] ??= []; });
    db.document_sections ??= [];
    window.memoryOrganizationAvailable = true;
    window.longDocumentIngestionAvailable = false;
    await window.MemoryOrganizationService?.ensureDefaults();
  } else {
    await loadRemoteDatabase();
  }
  renderNav();
  showPage('home');
};

window.enterApp = async function enterSupabaseApp(account) {
  user = { id: account?.id || 'demo-user', email: account?.email || 'Demonstração' };
  document.querySelector('#userName').textContent = user.email;
  document.querySelector('#userMode').textContent = account ? 'Supabase conectado' : 'Demonstração local';
  document.querySelector('#authView').classList.add('hidden');
  document.querySelector('#appView').classList.remove('hidden');
  document.querySelector('#content').innerHTML = '<div class="empty">Carregando sua memória…</div>';
  try {
    await window.init();
  } catch (error) {
    document.querySelector('#content').innerHTML = `<div class="card"><h3>Não foi possível carregar seus dados</h3><p class="muted">${escapeHtml(error.message)}</p></div>`;
    toast('Falha ao conectar ao Supabase.');
  }
};

function normalizePayload(table, input) {
  const payload = { ...input };
  Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
  if (table === 'decisions' && typeof payload.options_considered === 'string') {
    const raw = payload.options_considered.trim();
    if (!raw) payload.options_considered = [];
    else {
      try { payload.options_considered = JSON.parse(raw); }
      catch { payload.options_considered = raw.split('\n').map(x => x.trim()).filter(Boolean); }
    }
  }
  if ('metadata' in payload && (payload.metadata === null || typeof payload.metadata !== 'object')) payload.metadata = {};
  return payload;
}

window.save = async function saveToSupabase(table, input, old = null) {
  if (!isRemoteUser()) {
    const now = new Date().toISOString();
    if (old) Object.assign(old, input, { updated_at: now });
    else db[table].push({ id: uid(), owner_id: user.id, visibility: 'private', created_at: now, updated_at: now, metadata: {}, ...input });
    persist();
    toast(old ? 'Alterações salvas' : 'Registro criado');
    return old || db[table][db[table].length - 1];
  }

  try {
    const payload = normalizePayload(table, input);
    let saved;
    if (old) {
      delete payload.id; delete payload.owner_id; delete payload.created_at;
      payload.updated_at = new Date().toISOString();
      const { data, error } = await sb.from(table).update(payload).eq('id', old.id).select().single();
      if (error) throw error;
      saved = data;
      const index = db[table].findIndex(row => row.id === old.id);
      if (index >= 0) db[table][index] = saved;
    } else {
      const now = new Date().toISOString();
      const row = table === 'inbox_items'
        ? { id: uid(), owner_id: user.id, visibility: 'private', submitted_at: now, updated_at: now, metadata: {}, ...payload }
        : { id: uid(), owner_id: user.id, visibility: 'private', created_at: now, updated_at: now, metadata: {}, ...payload };
      const { data, error } = await sb.from(table).insert(row).select().single();
      if (error) throw error;
      saved = data;
      db[table].push(saved);
    }
    toast(old ? 'Alterações salvas no Supabase' : 'Registro salvo no Supabase');
    if (page === table) showPage(table);
    return saved;
  } catch (error) {
    toast(`Não foi possível salvar: ${error.message}`);
    throw error;
  }
};

window.relationForm = function relationFormSupabase(sourceType, sourceId) {
  modal('Criar relação', `<form id="relationForm"><div class="form-grid"><label>Tipo do destino<select name="target_type" id="relationType">${Object.entries(labels).filter(([key]) => key !== 'inbox_items').map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select></label><label>Registro de destino<select name="target_id" id="relationTarget"></select></label><label>Tipo de relação<select name="relation_type">${['related_to','located_in','created_by','designed_by','written_by','visited_during','part_of','influences','supports','contradicts','analyzes','recommends','mentions','applies_to','source_for','decision_about','experience_with'].map(value => `<option>${value}</option>`).join('')}</select></label><label>Confiança<input name="confidence" type="number" min="0" max="100" value="80"></label><label class="full-span">Descrição opcional<textarea name="description"></textarea></label></div><div class="form-actions"><button type="button" class="btn secondary" data-close>Cancelar</button><button class="btn primary" id="saveRelation">Criar relação</button></div></form>`);
  const updateTargets = () => {
    const type = document.querySelector('#relationType').value;
    document.querySelector('#relationTarget').innerHTML = recs(type).filter(row => row.id !== sourceId).map(row => `<option value="${row.id}">${title(row)}</option>`).join('') || '<option value="">Nenhum registro disponível</option>';
  };
  document.querySelector('#relationType').onchange = updateTargets; updateTargets();
  document.querySelector('#relationForm').onsubmit = async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));
    if (!values.target_id) return toast('Selecione outro registro.');
    const button = document.querySelector('#saveRelation'); button.disabled = true; button.textContent = 'Salvando…';
    const row = { id: uid(), owner_id: user.id, source_type: sourceType, source_id: sourceId, ...values, confidence: Number(values.confidence), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    try {
      if (isRemoteUser()) {
        const { data, error } = await sb.from('relations').insert(row).select().single();
        if (error) throw error;
        db.relations.push(data);
      } else { db.relations.push(row); persist(); }
      closeModal(); toast('Relação criada.'); detail(sourceType, sourceId);
    } catch (error) { button.disabled = false; button.textContent = 'Criar relação'; toast(`Falha ao criar relação: ${error.message}`); }
  };
};

async function sha256(file) {
  const bytes = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
}

function safeFilename(name) {
  // Equivalente ao original replace(/[̀-ͯ]/g,''): após NFD, os
  // diacríticos combinantes ficam fora do ASCII; remove-os e troca o resto.
  return name.normalize('NFD').replace(/[^\x00-\x7F]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-');
}

window.fileForm = function fileFormSupabase() {
  modal('Enviar arquivo', `<form id="fileForm"><div class="form-grid"><label class="full-span">Arquivo<input type="file" name="file" accept=".pdf,.docx,.txt,.md,.rtf,.jpg,.jpeg,.png,.webp,.mp3,.wav,.webm,.xlsx,.csv" required></label><label class="full-span">Comentário opcional<textarea name="note" placeholder="O que este arquivo contém?"></textarea></label><label>Domínio<select name="domain"><option value="">Sem domínio</option>${domains.map(domain => `<option>${domain}</option>`).join('')}</select></label><label>Código do Projeto<input name="project_code" placeholder="Ex.: 26.181"></label></div><p class="muted">Máximo de 50 MB para armazenamento. PDF, DOCX, TXT, Markdown, CSV e RTF de até 25 MB também podem ser interpretados pela IA.</p><div class="form-actions"><button type="button" class="btn secondary" data-close>Cancelar</button><button class="btn primary" id="uploadFile">Enviar arquivo</button></div></form>`);
  document.querySelector('#fileForm').onsubmit = async event => {
    event.preventDefault();
    const file = event.target.file.files[0];
    if (!file) return;
    if (!isRemoteUser()) return toast('Entre na sua conta para enviar arquivos.');
    if (file.size > 50 * 1024 * 1024) return toast('O arquivo excede o limite de 50 MB.');
    if (file.type && !allowedUploadTypes.has(file.type)) return toast('Este tipo de arquivo não é permitido.');
    const button = document.querySelector('#uploadFile'); button.disabled = true; button.textContent = 'Verificando…';
    try {
      const checksum = await sha256(file);
      const { data: duplicate, error: duplicateError } = await sb.from('files').select('id,original_filename').eq('checksum', checksum).maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicate) throw new Error(`Este arquivo já foi enviado como “${duplicate.original_filename}”.`);
      const fileId = uid();
      const storagePath = `${user.id}/${fileId}-${safeFilename(file.name)}`;
      button.textContent = 'Enviando…';
      const { error: uploadError } = await sb.storage.from(activeStorageBucket).upload(storagePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (uploadError) throw uploadError;
      const fileRow = { id: fileId, owner_id: user.id, original_filename: file.name, storage_path: storagePath, mime_type: file.type || 'application/octet-stream', file_size: file.size, checksum, processing_status: 'uploaded', visibility: 'private', created_at: new Date().toISOString() };
      const { data: savedFile, error: fileError } = await sb.from('files').insert(fileRow).select().single();
      if (fileError) { await sb.storage.from(activeStorageBucket).remove([storagePath]); throw fileError; }
      const inboxRow = { id: uid(), owner_id: user.id, input_type: file.type.startsWith('audio/') ? 'audio' : 'file', title: file.name, raw_text: event.target.note.value || null, domain: event.target.domain.value || null, project_code: event.target.project_code.value || null, file_id: savedFile.id, source_channel: 'upload', processing_status: 'new', visibility: 'private', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(), metadata: {} };
      const { data: savedInbox, error: inboxError } = await sb.from('inbox_items').insert(inboxRow).select().single();
      if (inboxError) throw inboxError;
      db.files.push(savedFile); db.inbox_items.push(savedInbox);
      closeModal(); toast('Arquivo enviado. Use “Interpretar com IA” na Caixa de entrada.'); showPage('inbox');
    } catch (error) { button.disabled = false; button.textContent = 'Enviar arquivo'; toast(error.message); }
  };
};

window.organize = function organizeSupabase(id) {
  const item = db.inbox_items.find(row => row.id === id);
  modal('Organizar material', `<p class="muted">Transforme “${item.title}” em um registro estruturado.</p><div class="type-grid">${['entities','knowledge_items','experiences','decisions'].map(table => `<button class="capture-option" data-transform="${table}"><b>${icons[table]} ${labels[table]}</b><small>Criar a partir deste material.</small></button>`).join('')}</div>`);
  document.querySelectorAll('[data-transform]').forEach(button => button.onclick = async () => {
    const table = button.dataset.transform;
    if (isRemoteUser()) {
      const { error } = await sb.from('inbox_items').update({ processing_status: 'approved', updated_at: new Date().toISOString() }).eq('id', id);
      if (error) return toast(error.message);
    }
    item.processing_status = 'approved'; persist(); closeModal();
    openForm(table, { title: item.title, canonical_name: item.title, content: item.raw_text, description: item.raw_text, context: item.raw_text, domain: item.domain, project_code: item.project_code });
  });
};

window.logout = async function logoutSupabase() {
  if (isRemoteUser()) await sb.auth.signOut();
  db = {}; user = { id: 'demo-user', email: 'Demonstração' };
  document.querySelector('#appView').classList.add('hidden');
  document.querySelector('#authView').classList.remove('hidden');
};

// Restaura automaticamente uma sessão Supabase ainda válida ao recarregar a página.
if (sb) sb.auth.getSession().then(({ data }) => {
  if (data.session?.user) enterApp(data.session.user);
});
