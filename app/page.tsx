export default function Home() {
  return (
    <main style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
        Patrick&apos;s Assistant
      </h1>
      <p style={{ color: '#888', marginBottom: '2rem' }}>
        Construction project management via Telegram
      </p>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        width: '100%',
        maxWidth: '300px',
      }}>
        <a
          href="/record"
          style={{
            padding: '1rem 2rem',
            backgroundColor: '#2563eb',
            color: 'white',
            borderRadius: '8px',
            fontWeight: 500,
          }}
        >
          Record Voice Note
        </a>

        <div style={{
          padding: '1rem',
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          fontSize: '0.875rem',
          color: '#888',
        }}>
          <p>Message the bot on Telegram</p>
          <p style={{ marginTop: '0.5rem' }}>or use the voice recorder for longer meetings</p>
        </div>
      </div>

      <footer style={{
        position: 'fixed',
        bottom: '1rem',
        fontSize: '0.75rem',
        color: '#666',
      }}>
        Built by Aidan
      </footer>
    </main>
  );
}
