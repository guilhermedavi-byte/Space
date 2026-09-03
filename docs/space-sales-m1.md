# Space Sales Intelligence — M1 data boundary

The application uses `meeting_id` as its sole canonical call identity. Tables whose persisted key is `call_id` are queried with `call_id == meeting_id`; no synthetic browser identity is created.

`CallsRepository` joins modalities server-side and represents absent intelligence as nullable fields or empty event collections. The temporary diagnostic route `/debug/calls/[meetingId]` exercises that repository without exposing the service-role credential. Raw rows are runtime-validated while generated live-schema types are unavailable.

Outcome aggregation must use `known = won + lost`. `unknown` is never converted to `lost`.
