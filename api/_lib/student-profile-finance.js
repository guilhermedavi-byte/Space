const { supabaseFetch } = require('./supabase-rest');

// Presentation-only read: canonical links and existing financial projections.
// No recovery materialization, provider requests, or financial transitions.
async function readStudentProfileFinance(studentId, { request = supabaseFetch, connectionId = process.env.FINANCE_CONNECTION_ID } = {}) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(studentId || '')) throw Object.assign(new Error('invalid_student_id'), { status: 400 });
  if (!/^[a-f0-9-]{36}$/i.test(connectionId || '')) throw new Error('finance_connection_unavailable');
  const all = async (table, select, filter, order = 'id') => {
    const rows = [];
    for (let offset = 0; offset < 20000; offset += 500) {
      const { data } = await request(`/${table}?connection_id=eq.${connectionId}&select=${select}&${filter}&order=${order}&limit=500&offset=${offset}`, { method: 'GET' });
      if (!Array.isArray(data)) throw new Error('finance_read_failed');
      rows.push(...data);
      if (data.length < 500) return rows;
    }
    throw new Error('finance_read_limit');
  };
  const links = await all('finance_customer_student_links', 'asaas_customer_id,firestore_doc_id', `firestore_doc_id=eq.${encodeURIComponent(studentId)}`, 'asaas_customer_id');
  const customers = [...new Set(links.map(row => row.asaas_customer_id))];
  if (customers.some(id => !/^cus_[A-Za-z0-9_-]+$/.test(id))) throw new Error('invalid_customer_link');
  const charges = [];
  for (const id of customers) {
    charges.push(...await all('finance_receivables', 'id,asaas_payment_id,asaas_customer_id,status,value,due_date,deleted', `asaas_customer_id=eq.${encodeURIComponent(id)}`));
  }
  const paymentIds = [...new Set(charges.filter(row => !row.deleted).map(row => row.asaas_payment_id))];
  if (paymentIds.some(id => !/^pay_[A-Za-z0-9_-]+$/.test(id))) throw new Error('invalid_payment_link');
  const payments = [];
  for (let i = 0; i < paymentIds.length; i += 100) {
    payments.push(...await all('finance_payments', 'id,asaas_payment_id,status,value,payment_date,confirmed_date,refund_value', `asaas_payment_id=in.(${paymentIds.slice(i, i + 100).join(',')})`));
  }
  return {
    cobrancas: charges.filter(row => !row.deleted).map(row => ({ id: row.asaas_payment_id, firestore_doc_id: studentId, status: row.status, valor: row.value, vencimento: row.due_date })),
    pagamentos: payments.map(row => ({ id: row.id, firestore_doc_id: studentId, status: row.status, valor: row.value, valor_estornado: row.refund_value, data_pagamento: row.confirmed_date || row.payment_date })),
    errors: {},
  };
}
module.exports = { readStudentProfileFinance };
