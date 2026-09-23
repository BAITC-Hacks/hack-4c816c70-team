"use client";

export default function GlobalError({ reset }: { readonly error: Error; readonly reset: () => void }) {
  return <main style={{ padding: 32 }}><h1>Не удалось открыть приложение</h1><p>Попробуйте обновить страницу.</p><button type="button" onClick={reset}>Повторить</button></main>;
}
