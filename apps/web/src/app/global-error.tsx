'use client';

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="uz">
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center', maxWidth: 480 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Kutilmagan xato</h1>
            <p style={{ color: '#64748b', marginBottom: 16 }}>
              Ilovada xatolik yuz berdi. Sahifani yangilashga urinib ko&apos;ring.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Qayta urinish
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
