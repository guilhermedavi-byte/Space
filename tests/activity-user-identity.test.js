const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildUserIdentityMap,
  decorateActivityIdentity,
  decorateChecklistIdentity,
  decorateCommentIdentity,
  decorateWorkspaceIdentities,
} = require("../api/activities")._test;

test("activities resolve responsible avatar from canonical user identity", () => {
  const identities = buildUserIdentityMap([
    {
      firestoreDocId: "admin-1",
      nome: "Ana Admin",
      email: "ana@space.test",
      tipo: "admin",
      photoURL: "https://cdn.space.test/ana.jpg",
      avatarUpdatedAt: "2026-09-24T12:00:00.000Z",
    },
  ]);

  const activity = decorateActivityIdentity(
    { id: "act-1", responsavelId: "admin-1", responsavelNome: "Snapshot antigo" },
    identities
  );

  assert.equal(activity.responsavelNome, "Ana Admin");
  assert.equal(activity.responsavelIdentity.photoURL, "https://cdn.space.test/ana.jpg");
  assert.equal(activity.responsavelIdentity.avatarUpdatedAt, "2026-09-24T12:00:00.000Z");
});

test("comments prefer current profile photo over stale author snapshot", () => {
  const identities = buildUserIdentityMap([
    {
      id: "teacher-1",
      nome: "Prof. Bia",
      role: "teacher",
      photoURL: "https://cdn.space.test/bia-current.jpg",
    },
  ]);

  const comment = decorateCommentIdentity(
    {
      id: "comment-1",
      authorId: "teacher-1",
      authorNameSnapshot: "Nome antigo",
      authorPhotoSnapshot: "https://cdn.space.test/old.jpg",
      body: "Olá",
    },
    identities
  );

  assert.equal(comment.authorNameSnapshot, "Prof. Bia");
  assert.equal(comment.authorPhotoSnapshot, "https://cdn.space.test/bia-current.jpg");
  assert.equal(comment.authorIdentity.photoURL, "https://cdn.space.test/bia-current.jpg");
});

test("historical inactive users remain visible without unsafe name or email matching", () => {
  const identities = buildUserIdentityMap([
    {
      firestoreDocId: "inactive-1",
      nome: "Carlos Inativo",
      email: "carlos@space.test",
      role: "admin",
      ativo: false,
      photoURL: "https://cdn.space.test/carlos.jpg",
    },
  ]);

  const workspace = decorateWorkspaceIdentities(
    {
      activity: { id: "act-1", responsavelId: "inactive-1", responsavelNome: "Snapshot Carlos" },
      comments: [{ id: "comment-1", authorId: "inactive-1", authorNameSnapshot: "Carlos", body: "Histórico" }],
      checklist: [{ id: "check-1", assigneeId: "inactive-1", assigneeNameSnapshot: "Carlos" }],
    },
    identities
  );

  assert.equal(workspace.activity.responsavelIdentity.status, "inactive");
  assert.equal(workspace.comments[0].authorIdentity.name, "Carlos Inativo");
  assert.equal(workspace.checklist[0].assigneeIdentity.photoURL, "https://cdn.space.test/carlos.jpg");
});

test("legacy comments without user id keep snapshot fallback only", () => {
  const comment = decorateCommentIdentity(
    {
      id: "legacy-1",
      authorId: "",
      authorNameSnapshot: "Autor Legado",
      authorPhotoSnapshot: "https://cdn.space.test/legacy.jpg",
      body: "Registro antigo",
    },
    {}
  );

  assert.equal(comment.authorIdentity.id, "");
  assert.equal(comment.authorIdentity.name, "Autor Legado");
  assert.equal(comment.authorIdentity.photoURL, "https://cdn.space.test/legacy.jpg");
});
