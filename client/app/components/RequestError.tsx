import { safeMessage } from "../lib/request";

export default function RequestError({ message, onRetry }: { message: unknown; onRetry: () => void }) {
  return <div role="alert" className="surface my-6 border-red-200 bg-red-50 p-5 text-red-800">
    <p>{safeMessage(message)}</p>
    <button type="button" className="button-secondary mt-4" onClick={onRetry}>Retry</button>
  </div>;
}