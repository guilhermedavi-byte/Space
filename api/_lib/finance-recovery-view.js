// Pure read model. Stages describe calendar position; they never trigger actions.
const BUCKETS=[{id:'1-3',label:'1–3 dias',min:1,max:3},{id:'4-7',label:'4–7 dias',min:4,max:7},{id:'8-15',label:'8–15 dias',min:8,max:15},{id:'16-30',label:'16–30 dias',min:16,max:30},{id:'30+',label:'30+ dias',min:31,max:Infinity}];
const STAGES=['D-3','D-1','D0','D+1','D+3','D+7','Intervenção humana'];
function stage(days){return days < -3?'Fora da régua':days < -1?'D-3':days===-1?'D-1':days===0?'D0':days<3?'D+1':days<7?'D+3':days<16?'D+7':'Intervenção humana';}
function recovery(rows,cases=new Map()){
 const items=rows.filter(r=>r.group==='overdue'&&r.days_overdue>0).map(r=>{
  const item={...r,aging:BUCKETS.find(b=>r.days_overdue>=b.min&&r.days_overdue<=b.max).id,stage:stage(r.days_overdue),recovery_case:cases.get(r.id)||null};
  item.operational_status=item.recovery_case?.status_label||'Novo';
  item.stage=item.recovery_case?.current_rule_stage||item.stage;
  item.rule_state=item.recovery_case?.rule_state_label||'Ativa';
  item.next_action_date=item.recovery_case?.next_action_at||item.recovery_case?.next_action_date||item.recovery_case?.promised_payment_date||null;
  item.next_action_label=item.recovery_case?.next_action_type_label||item.recovery_case?.last_action_label||'Acompanhar';
  item.pending_actions=item.recovery_case?.pending_actions||0;
  item.approval_required_actions=item.recovery_case?.approval_required_actions||0;
  item.pending_action_ids=Array.isArray(item.recovery_case?.pending_action_ids)?item.recovery_case.pending_action_ids:[];
  return item;
 });
 const total=rs=>rs.reduce((n,r)=>{const value=n+(r.value??0);if(!Number.isSafeInteger(value))throw Error('finance_amount_invalid');return value;},0);
 const customers=new Set(items.map(r=>r.customer_id).filter(Boolean)),linked=new Set(items.filter(r=>r.linked).map(r=>r.customer_id).filter(Boolean));
 const value=total(items);
 return {items,kpis:{overdue:value,customers:customers.size,ticket:customers.size?Math.round(value/customers.size):0,average_days:items.length?Math.round(items.reduce((n,r)=>n+r.days_overdue,0)/items.length*10)/10:0},linked:linked.size,unlinked:customers.size-linked.size,charges:items.length,missing_values:items.filter(r=>r.value==null).length,aging:BUCKETS.map(b=>{const rs=items.filter(r=>r.aging===b.id);return {id:b.id,label:b.label,count:rs.length,value:total(rs)};}),stages:STAGES};
}
module.exports={recovery,stage};
