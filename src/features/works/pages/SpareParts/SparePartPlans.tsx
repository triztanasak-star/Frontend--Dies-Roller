import { useState } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';

export type ExecutionPlan = { id: string; name: string; tons: number; due_date: string };

export function PlanHistory({ plans }: { plans: ExecutionPlan[] }) {
  return plans.length ? <div className="spare-part-history">{plans.map((plan, index) => <div key={plan.id}>
    <strong>{index + 1}. {plan.name}</strong>
    <span className="text-muted ms-1">: {plan.tons.toLocaleString('vi-VN')} ton</span>
    {plan.due_date && <span className="text-muted ms-1">({plan.due_date.split('-').reverse().join('/')})</span>}
  </div>)}</div> : <span className="text-muted">—</span>;
}

export default function SparePartPlans({ plans, onChange, disabled, readOnly }: {
  plans: ExecutionPlan[]; onChange: (plans: ExecutionPlan[]) => void; disabled: boolean; readOnly: boolean;
}) {
  const [name, setName] = useState('');
  const [tons, setTons] = useState('');
  const [date, setDate] = useState('');
  function add() {
    if (!name.trim() || !Number.isFinite(Number(tons)) || Number(tons) < 0) return;
    onChange([...plans, { id: crypto.randomUUID(), name: name.trim(), tons: Number(tons), due_date: date }]);
    setName(''); setTons(''); setDate('');
  }
  const change = (id: string, patch: Partial<ExecutionPlan>) => onChange(plans.map(p => p.id === id ? { ...p, ...patch } : p));
  return <section className="mt-4 border-top pt-3" aria-label="Kế hoạch thực hiện">
    <h6 className="fw-bold mb-3">Kế hoạch thực hiện (hạng mục)</h6>
    {!readOnly && <fieldset disabled={disabled} className="mb-3"><div className="row g-2 align-items-end">
      <div className="col-md-6"><label htmlFor="new-plan-name" className="form-label">Hạng mục mới</label><textarea id="new-plan-name" className="form-control progress-modal-input" rows={1} placeholder="Thêm hạng mục mới…" maxLength={2000} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); } }} /></div>
      <div className="col-md-2"><label htmlFor="new-plan-tons" className="form-label">Số tấn</label><input id="new-plan-tons" type="number" min={0} step="any" className="form-control progress-modal-input" value={tons} onChange={e => setTons(e.target.value)} /></div>
      <div className="col-md-3"><label htmlFor="new-plan-date" className="form-label">Ngày thực hiện</label><input id="new-plan-date" type="date" className="form-control progress-modal-input" value={date} onChange={e => setDate(e.target.value)} /></div>
      <div className="col-md-1"><button type="button" className="btn btn-primary w-100" title="Thêm hạng mục" aria-label="Thêm hạng mục" disabled={!name.trim() || Number(tons) < 0 || plans.length >= 500} onClick={add}><FiPlus /></button></div>
    </div></fieldset>}
    {!plans.length ? <div className="text-muted text-center py-3 border rounded">Chưa có hạng mục nào.</div> : <fieldset disabled={disabled || readOnly}><div className="d-flex flex-column gap-2" style={{ maxHeight: 300, overflowY: 'auto' }}>
      {plans.map((plan, index) => <div key={plan.id} className="row g-2 p-2 mx-0 border rounded align-items-center">
        <div className="col-md-6"><textarea aria-label={`Hạng mục ${index + 1}`} className="form-control form-control-sm progress-modal-input" rows={1} required maxLength={2000} value={plan.name} onChange={e => change(plan.id, { name: e.target.value })} /></div>
        <div className="col-md-2"><div className="input-group input-group-sm"><input aria-label={`Số tấn hạng mục ${index + 1}`} className="form-control progress-modal-input" type="number" min={0} step="any" required value={plan.tons} onChange={e => change(plan.id, { tons: Number(e.target.value) })} /><span className="input-group-text">ton</span></div></div>
        <div className="col-md-3"><input aria-label={`Ngày thực hiện hạng mục ${index + 1}`} type="date" className="form-control form-control-sm progress-modal-input" value={plan.due_date} onChange={e => change(plan.id, { due_date: e.target.value })} /></div>
        {!readOnly && <div className="col-md-1"><button type="button" className="btn btn-sm btn-outline-danger w-100" aria-label={`Xóa hạng mục ${index + 1}`} onClick={() => onChange(plans.filter(p => p.id !== plan.id))}><FiTrash2 /></button></div>}
      </div>)}
    </div></fieldset>}
  </section>;
}
