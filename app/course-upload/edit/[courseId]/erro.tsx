"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="p-6 bg-red-50">
      <h2>حدث خطأ</h2>
      <button onClick={reset}>حاول مرة أخرى</button>
    </div>
  );
}
