const core = require('./core');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pt = new Intl.DisplayNames(['pt-BR'], { type: 'region' });
const en = new Intl.DisplayNames(['en'], { type: 'region' });
const countryRows = core.countries.map(code => ({ code, ddi: core.getCountryCallingCode(code), label: pt.of(code), english: en.of(code) })).sort((a,b) => a.label.localeCompare(b.label,'pt-BR'));
const fold = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const mounted = new WeakMap();
let counter = 0;
function PhoneDisplay(value, options = {}) {
  const phone = core.inspectPhone(value, options);
  const text = core.formatPhoneForDisplay(value, options) || '—';
  return phone.e164 ? `<a class="space-phone-display" href="tel:${esc(phone.e164)}">${esc(text)}</a>` : `<span class="space-phone-display">${esc(text)}</span>`;
}
function InternationalPhoneInput(input) {
  if (mounted.has(input)) return mounted.get(input);
  if (input.type === 'hidden') return null;
  const initial = core.inspectPhone(input.value);
  let country = initial.country || (input.value ? '' : input.dataset.phoneCountry || 'BR');
  let touching = false;
  const wrapper = document.createElement('div'); wrapper.className = 'space-international-phone';
  const id = `phone-country-${++counter}`;
  wrapper.innerHTML = `<button type="button" class="sip-country" aria-haspopup="dialog" aria-expanded="false" aria-controls="${id}"></button><input type="tel" class="sip-number" autocomplete="tel-national" aria-label="Número de telefone"><div id="${id}" class="sip-picker" role="dialog" aria-label="Escolher país" hidden><input type="search" class="sip-search" placeholder="Buscar país ou DDI" aria-label="Buscar país ou DDI"><div class="sip-options" role="list"></div></div><span class="sip-error" role="status" hidden></span>`;
  input.before(wrapper); wrapper.prepend(input); input.hidden = true; input.type = 'hidden'; input.dataset.phoneCanonical = 'true';
  const visible = wrapper.querySelector('.sip-number'), button = wrapper.querySelector('button'), picker = wrapper.querySelector('.sip-picker'), search = wrapper.querySelector('.sip-search'), options = wrapper.querySelector('.sip-options'), error = wrapper.querySelector('.sip-error');
  visible.required = input.required; visible.disabled = input.disabled; visible.readOnly = input.readOnly; button.disabled = input.disabled || input.readOnly;
  visible.setAttribute('aria-label', input.getAttribute('aria-label') || input.closest('label')?.textContent.trim() || 'Número de telefone');
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const read = () => descriptor.get.call(input);
  const write = value => descriptor.set.call(input, value);
  function updateCountry() { button.textContent = country ? `${core.flag(country)} +${core.getCountryCallingCode(country)} ▾` : 'País ▾'; button.setAttribute('aria-label', country ? `${pt.of(country)} (+${core.getCountryCallingCode(country)}) — escolher país` : 'Escolher país'); }
  function sync(value) { const p = core.inspectPhone(value); if (p.country) country = p.country; visible.value = p.e164 ? p.national : value; updateCountry(); }
  function validate() {
    const p = core.inspectPhone(visible.value, { defaultCountry: country || undefined, preferCountry: true });
    // A full pasted number selects its actual country only after it is valid.
    if (p.e164) { country = p.country || ''; updateCountry(); }
    write(p.e164 || visible.value.trim());
    wrapper.dataset.phoneState = p.state;
    const invalid = !['valid','empty'].includes(p.state) || (visible.required && p.state === 'empty');
    visible.setCustomValidity(invalid ? 'Digite um telefone válido para o país selecionado.' : '');
    visible.setAttribute('aria-invalid', String(invalid && touching));
    error.textContent = invalid && touching ? 'Número de telefone inválido.' : ''; error.hidden = !error.textContent;
    return !invalid;
  }
  Object.defineProperty(input,'value',{configurable:true,get:read,set(value){write(value); sync(String(value ?? ''));validate();}});
  if (input.id) { visible.id = input.id; input.removeAttribute('id'); }
  input.focus = (...args) => visible.focus(...args);
  input.select = () => visible.select();
  input.reportValidity = () => { touching = true; validate(); return visible.reportValidity(); };
  input.checkValidity = () => validate();
  function close() { picker.hidden = true; button.setAttribute('aria-expanded','false'); }
  function renderCountries() {
    const q = fold(search.value);
    options.innerHTML = countryRows.filter(r => fold(`${r.label} ${r.english} +${r.ddi} ${r.code}`).includes(q)).map(r => `<button type="button" class="sip-option" data-country="${r.code}" aria-label="${esc(r.label)} (+${r.ddi})">${core.flag(r.code)} ${esc(r.label)} <small>+${r.ddi}</small></button>`).join('');
  }
  button.addEventListener('click', () => { picker.hidden = !picker.hidden; button.setAttribute('aria-expanded',String(!picker.hidden)); if (!picker.hidden) { search.value='';renderCountries();search.focus(); } });
  search.addEventListener('input',renderCountries);
  options.addEventListener('click', event => { const selected = event.target.closest('[data-country]'); if (!selected) return; country = selected.dataset.country; updateCountry(); close(); touching = true; validate(); visible.focus(); });
  wrapper.addEventListener('keydown',event => { if(event.key==='Enter' && event.target===search){event.preventDefault();options.querySelector('button')?.click();return;} if(event.key==='Escape' && !picker.hidden){event.preventDefault();close();button.focus();} if(event.key==='ArrowDown' && !picker.hidden){event.preventDefault();(document.activeElement===search ? options.querySelector('button') : document.activeElement.nextElementSibling)?.focus();} if(event.key==='ArrowUp' && !picker.hidden){event.preventDefault();(document.activeElement.previousElementSibling || search)?.focus();} });
  visible.addEventListener('input', () => { touching = true; validate(); input.dispatchEvent(new Event('input',{bubbles:true})); });
  visible.addEventListener('paste', event => { const raw = event.clipboardData?.getData('text'); if(!raw)return; const p=core.inspectPhone(raw,{defaultCountry:country||undefined,preferCountry:true}); if(p.e164){event.preventDefault();country=p.country||country;visible.value=p.national;touching=true;updateCountry();validate();input.dispatchEvent(new Event('input',{bubbles:true}));} });
  // Preserve existing form/inline-editor contracts: their control still carries E.164.
  wrapper.addEventListener('focusout', event => { if(event.target===input)return;if(wrapper.contains(event.relatedTarget))return;close();touching=true;if(validate())input.dispatchEvent(new FocusEvent('focusout',{bubbles:true,relatedTarget:event.relatedTarget})); });
  visible.addEventListener('change',()=>{if(validate())input.dispatchEvent(new Event('change',{bubbles:true}));});
  visible.addEventListener('keydown',event=>{if(event.key==='Enter'){if(!validate()){event.preventDefault();visible.reportValidity();return;} if(!input.dispatchEvent(new KeyboardEvent('keydown',{key:event.key,bubbles:true,cancelable:true})))event.preventDefault();}});
  const result={input,visible,button,wrapper,validate,format:()=>sync(read())}; mounted.set(input,result); sync(input.value); validate();
  return result;
}
const selector = 'input[type="tel"]:not(.sip-number),input[data-finance-field="telefone"],input[name="phone"],input[name="telefone"],input[name="whatsapp"]';
function enhance(root = document) {
  if (root.matches?.(selector)) InternationalPhoneInput(root);
  root.querySelectorAll?.(selector).forEach(InternationalPhoneInput);
}
function boot() {
  enhance();
  new MutationObserver(records => { for(const record of records){ if(record.type==='childList')record.addedNodes.forEach(n=>{if(n.nodeType===1)enhance(n);}); if(record.type==='attributes' && mounted.has(record.target)){const x=mounted.get(record.target);x.visible.disabled=x.input.disabled;x.visible.readOnly=x.input.readOnly;x.visible.required=x.input.required;x.button.disabled=x.input.disabled||x.input.readOnly;} } }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','readonly','required']});
  document.addEventListener('submit',event=>{let first; event.target.querySelectorAll('[data-phone-canonical]').forEach(input=>{const x=mounted.get(input);if(x&&!x.validate())first ||=x;}); if(first){event.preventDefault();event.stopImmediatePropagation();first.input.reportValidity();}},true);
  document.addEventListener('reset',event=>{queueMicrotask(()=>event.target.querySelectorAll('[data-phone-canonical]').forEach(input=>{input.value=input.defaultValue;}));});
}
// Registered before the legacy application listeners; only canonical controls leave this boundary.
for (const type of ['focusout', 'change']) document.addEventListener(type, event => {
  const wrapper = event.target.closest?.('.space-international-phone');
  if (!wrapper || event.target.dataset?.phoneCanonical === 'true') return;
  event.stopImmediatePropagation();
  const input = wrapper.querySelector('[data-phone-canonical]');
  const instance = mounted.get(input);
  if (type === 'change' && event.target !== instance?.visible) return;
  if (type === 'focusout' && wrapper.contains(event.relatedTarget)) return;
  if (instance?.validate()) { instance.format(); input.dispatchEvent(type === 'focusout'
    ? new FocusEvent(type, { bubbles: true, relatedTarget: event.relatedTarget })
    : new Event(type, { bubbles: true })); }
}, true);
function requestPhone(label = 'Telefone', value = '') {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog'); dialog.className = 'sip-dialog';
    dialog.innerHTML = `<form><h3>${esc(label)}</h3><input type="tel" value="${esc(value)}"><div class="sip-dialog-actions"><button type="button" data-cancel>Cancelar</button><button type="submit">Confirmar</button></div></form>`;
    document.body.append(dialog);const original=dialog.querySelector('input');InternationalPhoneInput(original);
    const finish = value => {dialog.close();dialog.remove();resolve(value);};
    dialog.querySelector('[data-cancel]').onclick=()=>finish(null);
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
    dialog.querySelector('form').onsubmit=event=>{event.preventDefault();if(original.reportValidity())finish(original.value);};
    dialog.showModal();original.focus();
  });
}
document.addEventListener('keydown', event => {
  const wrapper=event.target.closest?.('.space-international-phone');const picker=wrapper?.querySelector('.sip-picker');
  if(event.key==='Escape' && picker && !picker.hidden){event.preventDefault();event.stopImmediatePropagation();picker.hidden=true;const button=wrapper.querySelector('.sip-country');button.setAttribute('aria-expanded','false');button.focus();}
},true);
window.SpaceInternationalPhone = { ...core, PhoneDisplay, InternationalPhoneInput, enhance, requestPhone };
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
