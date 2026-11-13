import { FiImage, FiChevronDown } from 'react-icons/fi';

export default function SparePartImages({ before, after, readOnly, disabled, onUpload, onRemove }: {
  before: string; after: string; readOnly: boolean; disabled: boolean;
  onUpload: (key: 'image_before' | 'image_after', file: File) => void;
  onRemove: (key: 'image_before' | 'image_after') => void;
}) {
  return <details className="mt-3 border rounded p-3 spare-part-images">
    <summary className="d-flex align-items-center gap-2" style={{ cursor: 'pointer' }}><FiImage /> Hình ảnh trước / sau làm <span className="badge text-bg-secondary">{Number(Boolean(before)) + Number(Boolean(after))}</span><FiChevronDown className="ms-auto" /></summary>
    <div className="row g-3 mt-1">{(['image_before', 'image_after'] as const).map(key => {
      const label = key === 'image_before' ? 'Hình trước làm' : 'Hình sau làm';
      const src = key === 'image_before' ? before : after;
      return <div className="col-md-6" key={key}>
        <label className="form-label" htmlFor={`part-${key}`}>{label}</label>
        {!readOnly && <input id={`part-${key}`} className="form-control progress-modal-input" type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={e => { const file = e.target.files?.[0]; if (file) onUpload(key, file); e.target.value = ''; }} />}
        {src ? <div className="mt-2"><a href={src} target="_blank" rel="noreferrer" aria-label={`Mở ${label.toLowerCase()}`}><img src={src} alt={label} style={{ width: '100%', height: 200, objectFit: 'contain' }} /></a>{!readOnly && <button type="button" className="btn btn-sm btn-outline-danger mt-2" disabled={disabled} onClick={() => onRemove(key)}>Xóa ảnh</button>}</div> : <div className="text-muted border rounded text-center p-4 mt-2">Chưa có ảnh</div>}
      </div>;
    })}</div>
    {!readOnly && <small className="text-muted d-block mt-2">PNG, JPEG, WebP · tối đa 3 MB mỗi ảnh</small>}
  </details>;
}
