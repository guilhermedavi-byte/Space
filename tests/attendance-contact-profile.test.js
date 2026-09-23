const test = require('node:test');
const assert = require('node:assert/strict');
const {contactProfile} = require('../api/_lib/attendance-contact-profile');
const link = (type,id,source='firestore') => ({resolution_state:'linked',internal_person_type:type,internal_person_id:id,internal_source:source});
test('Attendance reuses explicit master identity before CRM and WhatsApp photos', async () => {
 const calls=[];
 const result=await contactProfile({contact:{name:'WhatsApp',phone:'+5511999999999',avatar_url:'https://example.org/wa.jpg'},participants:[link('lead','c','crm'),link('student','s')]},async path=>{calls.push(path);return path==='users/s'?{name:'Pessoa Space',photoURL:'https://example.org/master.jpg',email:'space@example.org',privateData:'not-public'}:{name:'Lead CRM',photoURL:'https://example.org/crm.jpg'};});
 assert.equal(result.avatar_url,'https://example.org/master.jpg');assert.equal(result.name,'Pessoa Space');assert.equal(result.relationship,'Aluno');assert.equal(result.email,'space@example.org');assert.equal(result.privateData,undefined);assert.equal(calls.length,2);
});
test('No fuzzy phone lookup, ambiguous links, unknown sources or paths',async()=>{
 let calls=0;const result=await contactProfile({contact:{name:'Pessoa',phone:'11999999999'},participants:[{...link('student','s'),resolution_state:'ambiguous'},link('student','../secret'),link('student','s','unknown')]},async()=>{calls++;});
 assert.equal(calls,0);assert.equal(result.avatar_url,'');
});
test('CRM photo wins over WhatsApp when student has no photo; missing profile degrades safely',async()=>{
 const result=await contactProfile({contact:{avatar_url:'https://example.org/wa.jpg'},participants:[link('student','s'),link('lead','c','crm')]},async p=>p==='users/s'?{name:'Student'}:{photoURL:'https://example.org/crm.jpg'});
 assert.equal(result.avatar_url,'https://example.org/crm.jpg');
 const missing=await contactProfile({contact:{name:'Existing',avatar_url:'javascript:alert(1)'},participants:[link('student','s')]},async()=>{throw Error('private-secret');});
 assert.equal(missing.name,'Existing');assert.equal(missing.avatar_url,'');assert.equal(missing.profile_unavailable,true);assert.doesNotMatch(JSON.stringify(missing),/private-secret/);
});
