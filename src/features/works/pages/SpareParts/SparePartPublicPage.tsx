import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { getSparePartPublic } from '../../../../lib/db';
import { PlanHistory } from './SparePartPlans';
import { ImagePreview } from './SparePartPreview';
import './sparePartPublic.css';

export default function SparePartPublicPage() {
  const { id } = useParams();
  const partId = Number(id);
  const validId = Number.isSafeInteger(partId) && partId > 0;
  const [zoom, setZoom] = useState('');
  const query = useQuery({ queryKey: ['spare-part-public', partId], queryFn: () => getSparePartPublic(partId), enabled: validId, retry: 1 });
  const part = query.data;
  const errorMessage = !validId ? 'Mã QR không hợp lệ.'
    : isAxiosError(query.error) && query.error.response?.status === 404
      ? typeof query.error.response.data === 'object' ? 'Không tìm thấy phụ tùng này.' : 'Máy chủ chưa có API xem phụ tùng qua QR. Cần cập nhật backend đang chạy.'
      : isAxiosError(query.error) && query.error.response?.status === 401
        ? 'API phụ tùng đang yêu cầu đăng nhập. Cần cập nhật backend để cho phép xem qua QR.'
        : query.error instanceof Error && !isAxiosError(query.error) ? query.error.message : 'Không thể kết nối để tải phụ tùng. Vui lòng thử lại.';
  return <main className="spare-part-public"><div className="spare-part-public-content">
    <h1 className="h4 mb-4">Thông tin phụ tùng</h1>
    {!validId || query.isError ? <div className="alert alert-warning" role="alert">{errorMessage} {validId && <button className="btn btn-link" onClick={() => query.refetch()}>Thử lại</button>}</div> : query.isPending || !part ? <p role="status">Đang tải thông tin…</p> : <>
      <header style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)', color: '#fff', padding: 24, borderRadius: 12, marginBottom: 20, textAlign: 'center' }}><div className="small mb-2">THÔNG TIN PHỤ TÙNG</div><h2 className="h3 mb-2">{part.equipment}</h2><div>{part.system}</div></header>
      <section className="spare-part-public-card"><h2 className="h5">{part.equipment}</h2><div className="spare-part-public-fields">
        {([
          ['Hệ thống', part.system], ['Thông số kỹ thuật', part.specifications], ['Supplier', part.supplier],
          ['Số lượng tồn', part.stock_quantity], ['Số lượng đang sử dụng', part.in_use_quantity],
          ['Price (VNĐ)', Number(part.price_vnd).toLocaleString('vi-VN')], ['Standard (ton)', Number(part.standard_ton).toLocaleString('vi-VN')],
          ['Life (ton)', Number(part.life_ton).toLocaleString('vi-VN')], ['Line - Nguyên liệu sử dụng', Array.isArray(part.line_in_use) ? part.line_in_use.join(', ') : String(part.line_in_use ?? '')],
        ] as const).map(([label, value]) => <div className={`spare-part-public-field ${label === 'Thông số kỹ thuật' ? 'spare-part-public-wide' : ''}`} key={label}><div className="spare-part-public-label">{label}</div><div className="spare-part-public-value">{value === '' ? '—' : value}</div></div>)}
      </div></section>
      <section className="spare-part-public-card"><h2 className="h5">Lịch sử thực hiện</h2><PlanHistory plans={part.execution_plans ?? []} /></section>
      <section className="spare-part-public-card"><h2 className="h5">Hình ảnh trước / sau làm</h2><div className="row g-3">
        {([['Hình trước làm', part.image_before], ['Hình sau làm mới nhất', part.image_after]] as const).map(([label, src]) => <div className="col-12 col-sm-6" key={label}><p>{label}</p>{src ? <button className="btn p-0 w-100" aria-label={`Phóng lớn ${label.toLowerCase()}`} onClick={() => setZoom(src)}><img src={src} alt={label} style={{ width: '100%', maxHeight: 300, objectFit: 'contain' }} /></button> : <p className="text-muted">Chưa có ảnh</p>}</div>)}
      </div></section>
    </>}
    {zoom && <ImagePreview src={zoom} label="Hình ảnh phụ tùng" onClose={() => setZoom('')} />}
  </div></main>;
}
