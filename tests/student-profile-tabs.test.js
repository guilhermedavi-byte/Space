const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const script = fs.readFileSync(require.resolve('../script.js'), 'utf8');
const block = script.slice(script.indexOf('const STUDENT_PROFILE_TABS ='), script.indexOf('const renderStudentSheetInto ='));
function setup(fetcher = async () => ({ ok: true, json: async () => ({ activities: [], cobrancas: [], pagamentos: [] }) })) {
  const dom = new JSDOM('<main><aside id="left">Resumo preservado</aside><section id="sheet"></section></main>', { url: 'https://space.test' });
  const hist = { alunoId: 'student-1', alunoMeta: { id: 'student-1' }, items: [], activeTab: 'history' };
  const context = vm.createContext({ document: dom.window.document, console, Intl, Date, Set,
    escapeHtml: s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch])),
    formatAdminHistoryStamp: x => x, formatAdminDate: x => x, getRetentionTimelineEventLabel: x => x,
    normalizeStudentCancellationRecord: x => x || null,
    adminStudentsState: { history: hist }, teacherStudentsState: { history: {} },
    renderAdminStudentFilesTab() {}, ensureAdminStudentFilesLoaded() {}, fetchWithAuth: fetcher,
  });
  const api = vm.runInContext(block + ';({STUDENT_PROFILE_TABS,studentProfilePanel,renderStudentProfileTabs,bindStudentProfileTabs,getStudentProfileJourney,renderStudentProfileHistory,studentProfileRelated})', context);
  const sheet = dom.window.document.querySelector('#sheet');
  const mount = () => {
    sheet.innerHTML = `<div data-student-profile-content>${api.renderStudentProfileTabs(hist,'admin')}${api.STUDENT_PROFILE_TABS.map(([key])=>api.studentProfilePanel(key,key==='pedagogical'?'<textarea>Rascunho não enviado</textarea><button>+ Comentário</button>':'Conteúdo existente',hist,'admin')).join('')}</div>`;
    api.bindStudentProfileTabs(sheet,hist,'admin');
  };
  mount(); return { dom, hist, api, sheet, mount, context };
}
test('seis abas, uma ativa, troca sem remontar resumo ou rascunho e teclado acessível', async () => {
  const { dom, hist, sheet } = setup();
  const tabs = [...sheet.querySelectorAll('[role=tab]')];
  assert.deepEqual(tabs.map(t=>t.textContent), ['Histórico','Retenção','Pedagógico','Financeiro','Atividades','Documentos']);
  const left=dom.window.document.querySelector('#left'), draft=sheet.querySelector('textarea');
  for(const tab of tabs){tab.click();assert.equal(sheet.querySelectorAll('[aria-selected=true]').length,1);assert.equal(sheet.querySelectorAll('[role=tabpanel]:not([hidden])').length,1);}
  assert.equal(dom.window.document.querySelector('#left'),left);assert.equal(sheet.querySelector('textarea'),draft);
  assert.equal(draft.value,'Rascunho não enviado');
  tabs[5].dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Home',bubbles:true}));
  assert.equal(hist.activeTab,'history');assert.equal(dom.window.document.activeElement,tabs[0]);
});
test('histórico usa datas reais, combina fontes, escapa conteúdo e não inventa eventos vazios', () => {
  const { api, hist }=setup();
  assert.match(api.renderStudentProfileHistory(hist),/Nenhum registro no histórico ainda/);
  hist.items=[{id:'l1',createdAt:'2026-09-20',kind:'comment',summaryText:'<script>bad</script>'}];
  hist.retentionTimeline={events:[{id:'r1',occurred_at:'2026-09-21',event_type:'retract_cancellation'}]};
  hist.alunoMeta.cancelamentosAnteriores=[{dataPedido:'2026-09-19',motivo:'Falta de tempo',desfecho:'revertido',dataEfetivacao:'2026-09-22',eventos:[{data:'2026-09-22',acao:'Cancelamento revertido',detalhe:'Aluno decidiu continuar'}]}];
  assert.equal(api.getStudentProfileJourney(hist)[0].source,'Retenção');
  assert.match(api.renderStudentProfileHistory(hist),/Pedido de cancelamento/);
  assert.match(api.renderStudentProfileHistory(hist),/Cancelamento revertido/);
  assert.match(api.renderStudentProfileHistory(hist),/&lt;script&gt;/);
  assert.equal(api.studentProfileRelated({studentId:'another',responsavelId:'student-1'},hist),false);
  assert.equal(api.studentProfileRelated({studentId:'student-1'},hist),true);
});
test('resposta assíncrona atualiza ficha remontada sem contaminar outro aluno e só usa GET', async () => {
  const pending=[];const requests=[];
  const app=setup((url,options)=>{requests.push({url,options});return new Promise(resolve=>pending.push({url,resolve}));});
  app.mount();
  pending.forEach(({url,resolve})=>resolve({ok:true,json:async()=>url.includes('activities')?{activities:[{id:'a1',studentId:'student-1',titulo:'Revisar objetivo',status:'Pendente'}]}:{cobrancas:[],pagamentos:[]}}));
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(app.sheet.querySelector('[data-student-profile-panel=activities]').textContent,/Revisar objetivo/);
  assert.ok(requests.every(x=>x.options.method==='GET'));
  assert.ok(requests.every(x=>!x.url.includes('finance-v1')));
});
