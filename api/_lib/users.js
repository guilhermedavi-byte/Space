const SEED_USERS = [
  {
    id: "u_admin_guilherme",
    name: "Guilherme Davi",
    email: "guilhermedavi@spaceschoolbr.com",
    role: "admin",
    passwordHash: "pbkdf2$sha256$210000$ZnquV0SRVWtO+qZGHdX53g==$SPoGSP1hUA9rvnVSX7WyIJpV1qPk3PCQTE5epsCKn9w=",
  },
  {
    id: "u_teacher_space",
    name: "Teacher Space",
    email: "teacher@spaceschoolbr.com",
    role: "teacher",
    passwordHash: "pbkdf2$sha256$210000$KkTUv7Q54MwDXPOt3DThtg==$cThXjnuOGNVgGdgIj1+2Zf0uti+zW8SZ/sW5+J98EMc=",
  },
  {
    id: "u_student_space",
    name: "Student Space",
    email: "student@spaceschoolbr.com",
    role: "student",
    passwordHash: "pbkdf2$sha256$210000$EHReJ8S1I6dZWF4i1qsFFw==$Sbqkg8FcQeLdi3nBDRST7uTRVwDlj37G5CRLi2NyVTY=",
  },
];

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "student" || raw === "aluno") return "student";
  if (raw === "teacher" || raw === "professor") return "teacher";
  if (raw === "admin" || raw === "administrador") return "admin";
  return "";
};

const sanitizeUser = (value) => {
  if (!value || typeof value !== "object") return null;
  const id = typeof value.id === "string" ? value.id : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const role = normalizeRole(value.role);
  const passwordHash = typeof value.passwordHash === "string" ? value.passwordHash : "";
  if (!id || !name || !email || !role || !passwordHash) return null;
  return { id, name, email, role, passwordHash };
};

const loadUsers = () => {
  return SEED_USERS.map(sanitizeUser).filter(Boolean);
};

const findUserByEmailAndRole = (users, { email, role }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedRole = normalizeRole(role);
  if (!normalizedEmail || !normalizedRole) return null;
  return users.find((u) => u.email === normalizedEmail && u.role === normalizedRole) || null;
};

module.exports = { loadUsers, findUserByEmailAndRole, normalizeRole };
