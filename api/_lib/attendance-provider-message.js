const unwrap = message => {
 let m=message||{};
 for(let i=0;i<4;i++){const nested=m.ephemeralMessage?.message||m.viewOnceMessage?.message||m.viewOnceMessageV2?.message||m.documentWithCaptionMessage?.message;if(!nested)break;m=nested;}
 return m;
};
function remoteIdentity(key={}) {
 const aliases=[key.remoteJid,key.remoteJidAlt].filter(v=>typeof v==='string'&&/^\d{7,20}(?::\d+)?@(s\.whatsapp\.net|lid)$/.test(v)).map(v=>v.replace(/:\d+@/,'@'));
 if(!aliases.length||/@g\.us$|@broadcast$/.test(key.remoteJid||''))return null;
 const pn=aliases.find(v=>v.endsWith('@s.whatsapp.net'));
 return {jid:pn||aliases[0],aliases:[...new Set(aliases)],phone:pn?pn.split('@')[0]:null};
}
const transportStatus=value=>({0:'failed',1:'sent',2:'sent',3:'delivered',4:'read',5:'read',ERROR:'failed',FAILED:'failed',PENDING:'sent',SERVER_ACK:'sent',SENT:'sent',DELIVERY_ACK:'delivered',DELIVERED:'delivered',READ:'read',PLAYED:'read'})[String(value??'').toUpperCase()]||null;
const quotedId=m=>Object.values(m||{}).find(v=>v&&typeof v==='object'&&v.contextInfo?.stanzaId)?.contextInfo.stanzaId||null;
module.exports={unwrap,remoteIdentity,transportStatus,quotedId};
