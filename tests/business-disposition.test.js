const test = require('node:test');
const assert = require('node:assert/strict');
const { businessDisposition } = require('../api/_lib/business-disposition');
const { analysisIntegrity } = require('../api/_lib/space-phone-analysis-integrity');
for (const outcome of ['nao_atendeu','ocupado','caixa_postal','numero_invalido','sem_interesse','retornar_depois','interessado','agendado']) {
 test(`commercial outcome ${outcome} overrides every technical status`,()=>{
  const human = ['sem_interesse','retornar_depois','interessado','agendado'].includes(outcome);
  for (const status of ['connected','failed','ended','ringing','completed']) {
   const d = businessDisposition({outcome,status,duration_seconds:100});
   assert.equal(d.humanContact,human); assert.equal(d.unanswered,!human);
   assert.equal(d.humanTalkTimeSeconds,human ? 100 : 0);
   assert.equal(d.scheduled,outcome==='agendado');
  }
 });
}
test('voicemail transcript and scheduled outcome raise inconsistency, not rewrite facts',()=>{
 assert.equal(analysisIntegrity({outcome:'agendado'},{transcript:'Your call has been forwarded to voicemail.'}).inconsistent,true);
 assert.equal(analysisIntegrity({outcome:'caixa_postal'},{transcript:'Your call has been forwarded to voicemail.'}).inconsistent,false);
});
