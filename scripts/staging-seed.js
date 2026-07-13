const RESERVED_EMAIL_DOMAINS = ["example.com", "example.net", "example.org", "space.test", "space.invalid"];

const email = (local, domain = "example.com") => `${local}@${domain}`;

const buildStagingSeedDataset = () => ({
  generatedAt: "2026-07-12T00:00:00.000Z",
  students: [
    { student_id: "stg-student-001", full_name: "Alice Teste Notice", email: email("alice.notice"), phone: "+5511911111111" },
    { student_id: "stg-student-002", full_name: "Bruno Teste Active", email: email("bruno.active"), phone: "+5511922222222" },
    { student_id: "stg-student-003", full_name: "Clara Teste Paused", email: email("clara.paused"), phone: "+5511933333333" },
    { student_id: "stg-student-004", full_name: "Diego Teste Ended", email: email("diego.ended"), phone: "+5511944444444" },
    { student_id: "stg-student-005", full_name: "Eva Ambígua", email: email("eva.ambigua"), phone: "+5511955555555" },
  ],
  teachers: [
    { teacher_id: "stg-teacher-001", full_name: "Prof. Amanda Fictícia", email: email("amanda.teacher") },
    { teacher_id: "stg-teacher-002", full_name: "Prof. Rafael Fictício", email: email("rafael.teacher") },
  ],
  enrollments: [
    { enrollment_id: "stg-enr-001", student_id: "stg-student-001", teacher_id: "stg-teacher-001", enrollment_status: "notice" },
    { enrollment_id: "stg-enr-002", student_id: "stg-student-002", teacher_id: "stg-teacher-001", enrollment_status: "active" },
    { enrollment_id: "stg-enr-003", student_id: "stg-student-003", teacher_id: "stg-teacher-002", enrollment_status: "paused" },
    { enrollment_id: "stg-enr-004", student_id: "stg-student-004", teacher_id: "stg-teacher-002", enrollment_status: "ended" },
  ],
  payers: [
    { payer_id: "stg-payer-001", display_name: "Pagador Familiar Teste", email: email("familia.pagadora") },
    { payer_id: "stg-payer-002", display_name: "Pagador Empresa Teste", email: email("empresa.pagadora", "example.org") },
  ],
  financialContracts: [
    { contract_id: "stg-contract-001", payer_id: "stg-payer-001", contract_status: "active" },
    { contract_id: "stg-contract-002", payer_id: "stg-payer-002", contract_status: "past_due" },
  ],
  contractItems: [
    {
      contract_item_id: "stg-item-001",
      contract_id: "stg-contract-001",
      student_id: "stg-student-001",
      description: "Plano Familiar A",
      quantity: 1,
      unit_amount: 450,
      discount_amount: 50,
      final_amount: 400,
      item_status: "active",
    },
    {
      contract_item_id: "stg-item-002",
      contract_id: "stg-contract-001",
      student_id: "stg-student-002",
      description: "Plano Familiar B",
      quantity: 1,
      unit_amount: 450,
      discount_amount: 50,
      final_amount: 400,
      item_status: "active",
    },
    {
      contract_item_id: "stg-item-003",
      contract_id: "stg-contract-002",
      student_id: "stg-student-004",
      description: "Ex-aluno inadimplente",
      quantity: 1,
      unit_amount: 320,
      discount_amount: 0,
      final_amount: 320,
      item_status: "ended",
    },
  ],
  charges: [
    { charge_id: "stg-charge-001", contract_id: "stg-contract-001", charge_status: "pending", amount: 800, due_date: "2026-07-20" },
    { charge_id: "stg-charge-002", contract_id: "stg-contract-002", charge_status: "overdue", amount: 320, due_date: "2026-06-10" },
  ],
  chargeAllocations: [
    { charge_allocation_id: "stg-alloc-001", charge_id: "stg-charge-001", contract_item_id: "stg-item-001", student_id: "stg-student-001", allocated_amount: 400 },
    { charge_allocation_id: "stg-alloc-002", charge_id: "stg-charge-001", contract_item_id: "stg-item-002", student_id: "stg-student-002", allocated_amount: 400 },
    { charge_allocation_id: "stg-alloc-003", charge_id: "stg-charge-002", contract_item_id: "stg-item-003", student_id: "stg-student-004", allocated_amount: 320 },
  ],
  reconciliationItems: [
    { reconciliation_item_id: "stg-rec-001", item_status: "ambiguous", suggestion_confidence: 72, source_kind: "combined" },
    { reconciliation_item_id: "stg-rec-002", item_status: "financial_only", suggestion_confidence: 98, source_kind: "finance_legacy" },
  ],
  reservedEmailDomains: RESERVED_EMAIL_DOMAINS,
});

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(buildStagingSeedDataset(), null, 2)}\n`);
}

module.exports = {
  RESERVED_EMAIL_DOMAINS,
  buildStagingSeedDataset,
};
