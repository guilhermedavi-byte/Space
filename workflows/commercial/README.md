# Commercial action protection

The V7 audit is evidence, not authorization. `api/integrations/n8n/commercial-action.js` is the only intended writer for the ten CRM and meeting-status sinks. Authentication uses server-only COMMERCIAL_ACTION_SECRET. The engine reads fresh CRM and student sources, logs decisions, claims an occurrence/action key atomically, rechecks the business and only then writes. Uncertain remote results remain fenced until reconciled; never automatically release them for retry.

## Transition matrix

| Current state | Automated presales transition |
|---|---|
| Scheduled in the configured sales pipeline | Attended with exact identity, appointment and verified attendance |
| Scheduled in the configured sales pipeline | No-show only with completed independent absence observation |
| Attended / No-show | Child note/attachment/status only for the matching, eligible outcome |
| Won, onboarding, Cursando, active student, retention, cancellation | Blocked |
| Unknown, incomplete lookup, technical failure, ambiguous identity | Blocked / review |

Names, substrings, transcript emptiness and left_alone never establish identity or attendance. The adapter preserves speaker labels. Queries use exact scheduled occurrence; meeting status writes use appointment ID, not a shared Meet URL.

## Deployment

Migration 20260925131619 creates RLS-protected decisions and claims plus service-role-only RPCs. No legacy data is deleted. Deploy backend and secret before replacing the V7 export. The transformer updates the existing workflow ID and keeps it inactive until explicitly published after verification:

```
node workflows/commercial/build-protected-workflow.cjs /private/workflow-before.json /private/.engine-secret /private/workflow-protected.json
```

Never commit credential-bearing exports. Import only into VEXACOMV7SPACE01. Confirm there are 56 nodes and all ten sinks POST to the protected endpoint. Preserve existing OAuth/Drive credentials. Do not publish an old unsafe version as rollback: unpublish the workflow first, then roll back backend if needed. Keep audit tables and incident history intact.

## Attendance limitation

The observed Vexa output does not certify an observed participant roster. Invitations and transcript speaker names cannot prove attendance or absence. Accordingly `transcript.js` emits unknown attendance. Commercial audit evidence may continue for deterministically linked, non-student sales meetings, but automatic CRM transitions remain blocked until an authoritative attendance adapter is certified. Do not turn this into `true` from `left_alone`, speaker names or an AI result. The policy positive-path fixtures certify the contract, not availability of that live source.

## Certification 2026-09-25

28 dedicated tests pass: positive sales decisions with certified evidence; active students; Cursando; prior won deal; empty/failed transcription; same Meet different occurrence; partial identity; duplicate/concurrent events; uncertain writes; state conflict; all ten workflow sinks.

Production backend replay of real meetings 436 and 464 returned HTTP 200, action_allowed=false and BLOCKED_EXISTING_STUDENT; decisions persisted without CRM writes. This is backend replay, not a new end-to-end n8n execution.

The proven incident business was restored from No-show to Cursando/Timeline after pre-write audit and concurrent-state check. Decision: dd07f7a8-8ea7-4147-8e0e-5bdd87b5b9af. Existing history was preserved.

As of this commit, n8n import/publication is NOT certified: Chrome refused file import and the user was interacting with the native window. The original workflow export was inactive. Do not claim that deployed backend alone protects the old direct n8n PATCH nodes.
