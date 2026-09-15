export default function LoadingOverlay({ label = 'Đang tải...' }: { label?: string }) {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
      <div className="spinner-border text-primary mb-2" role="status" aria-label={label} />
      <span>{label}</span>
    </div>
  );
}
