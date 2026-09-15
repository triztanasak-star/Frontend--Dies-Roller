export default function ErrorState({ message = 'Có lỗi xảy ra, vui lòng thử lại.' }: { message?: string }) {
  return <div className="alert alert-danger" role="alert">{message}</div>;
}
