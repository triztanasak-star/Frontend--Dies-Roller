import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { FiDownload } from 'react-icons/fi';

export function ImagePreview({ src, label, onClose }: { src: string; label: string; onClose: () => void }) {
  useEffect(() => { const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [onClose]);
  return <div className="modal d-block" role="dialog" aria-modal="true" aria-label={label} style={{ background: 'rgba(0,0,0,.85)', zIndex: 1080 }} onClick={onClose}>
    <div className="modal-dialog modal-xl modal-dialog-centered" onClick={e => e.stopPropagation()}><div className="modal-content">
      <div className="modal-header"><h5 className="modal-title">{label}</h5><button type="button" className="btn-close" aria-label="Đóng ảnh" autoFocus onClick={onClose} /></div>
      <div className="modal-body text-center p-2"><img src={src} alt={label} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} /></div>
    </div></div>
  </div>;
}

export function SparePartQr({ id, equipment, system, onClose }: { id: number; equipment: string; system: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  const [origin, setOrigin] = useState(import.meta.env.VITE_PUBLIC_BASE_URL || (isLocal ? '' : window.location.origin));
  useEffect(() => {
    if (!isLocal || origin || !import.meta.env.DEV) return;
    let active = true;
    fetch('/__qr-address').then(r => r.json()).then(data => { if (active && data.origin) setOrigin(data.origin); }).catch(() => {});
    return () => { active = false; };
  }, [isLocal, origin]);
  let validOrigin = '';
  try { const candidate = new URL(origin); if (['http:', 'https:'].includes(candidate.protocol) && !['localhost', '127.0.0.1', '[::1]'].includes(candidate.hostname)) validOrigin = candidate.origin; } catch { /* User is still entering the address. */ }
  const url = validOrigin ? `${validOrigin}/spare-part/${id}` : '';
  function download() {
    const canvas = ref.current?.querySelector('canvas');
    if (!canvas || !url) return;
    const link = document.createElement('a'); link.download = `QR-phu-tung-${id}.png`; link.href = canvas.toDataURL('image/png'); link.click();
  }
  useEffect(() => { const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [onClose]);
  return <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="part-qr-title" style={{ background: 'rgba(0,0,0,.65)' }} onClick={onClose}>
    <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}><div className="modal-content">
      <div className="modal-header"><h5 id="part-qr-title" className="modal-title">Mã QR phụ tùng</h5><button type="button" className="btn-close" aria-label="Đóng QR" autoFocus onClick={onClose} /></div>
      <div className="modal-body text-center"><h5>{equipment}</h5><p className="text-muted">{system}</p>
        {isLocal && <div className="text-start mb-3"><label className="form-label" htmlFor="qr-site-origin">Địa chỉ website điện thoại truy cập được</label><input id="qr-site-origin" className="form-control" value={origin} onChange={e => setOrigin(e.target.value)} placeholder="http://192.168.x.x:5173 hoặc https://website-cua-ban" /><small className="text-muted">Nếu dùng địa chỉ mạng nội bộ, điện thoại và máy tính cần cùng Wi-Fi.</small></div>}
        {url ? <div ref={ref} className="d-inline-block bg-white p-2 rounded"><QRCodeCanvas value={url} size={256} level="H" marginSize={4} /></div> : <p className="alert alert-warning">Nhập địa chỉ website truy cập được từ điện thoại để tạo mã QR.</p>}
        <p className="small mt-3 mb-1">Quét bằng Zalo hoặc camera để xem thông tin và lịch sử phụ tùng.</p>
        {url && <a href={url} target="_blank" rel="noreferrer" className="small" style={{ overflowWrap: 'anywhere' }}>{url}</a>}
      </div><div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Đóng</button><button className="btn btn-primary" disabled={!url} onClick={download}><FiDownload /> Tải QR (PNG)</button></div>
    </div></div>
  </div>;
}
