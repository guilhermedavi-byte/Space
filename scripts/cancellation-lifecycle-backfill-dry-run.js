// Offline only: node scripts/cancellation-lifecycle-backfill-dry-run.js users.json output-directory
// Never reads credentials or writes a database. Input is an explicitly supplied export.
const fs = require('node:fs');
const path = require('node:path');
const { buildLegacyRetentionImportSnapshot } = require('../api/_lib/retention-import');
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('usage: users.json output-directory');
const rows = JSON.parse(fs.readFileSync(input,'utf8'));
if (!Array.isArray(rows)) throw new Error('expected_users_array');
const {report,payload} = buildLegacyRetentionImportSnapshot({users:rows,dryRun:true});
fs.mkdirSync(output,{recursive:true});
const cell = value => '"'+String(typeof value==='object'?JSON.stringify(value):value??'').replaceAll('"','""')+'"';
const columns=['identifier','record_ref','conflicting_data','reason','manual_action'];
fs.writeFileSync(path.join(output,'cancellation-lifecycle-backfill-exceptions.csv'),
  [columns.join(','),...report.exceptions.map(row=>columns.map(key=>cell(row[key])).join(','))].join('\n')+'\n');
fs.writeFileSync(path.join(output,'backfill-report.json'),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(output,'backfill-dry-run.json'),JSON.stringify(payload,null,2));
console.log(JSON.stringify({dryRun:true,students:report.importedStudents,events:report.importedEvents,exceptions:report.exceptions.length}));
