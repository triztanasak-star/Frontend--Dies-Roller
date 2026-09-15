export default function EmptyState({ message = 'Chưa có dữ liệu.' }: { message?: string }) {
  return <div className="text-center text-muted py-5">{message}</div>;
}
