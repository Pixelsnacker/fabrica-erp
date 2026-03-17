#!/usr/bin/env node
/**
 * Script to get Google Drive refresh token
 * Run: node get-drive-token.mjs
 */
import { createServer } from 'http';
import { URL } from 'url';

const CLIENT_ID = '311776758544-l81i1phln0mbedoqc6ghbqrcmv08u781.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'https://9876-iy3qzr9bcbkotb2r9s3i9-6fb6adde.us2.manus.computer/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('ERROR: GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET must be set');
  process.exit(1);
}

const scope = 'https://www.googleapis.com/auth/drive';

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${encodeURIComponent(CLIENT_ID)}&` +
  `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
  `response_type=code&` +
  `scope=${encodeURIComponent(scope)}&` +
  `access_type=offline&` +
  `prompt=consent`;

console.log('\n=== Google Drive Refresh Token Generator ===\n');
console.log('1. Öffne diesen Link in deinem Browser:');
console.log('\n' + authUrl + '\n');
console.log('2. Melde dich mit deinem Google-Konto an und erteile die Berechtigung.');
console.log('3. Du wirst zu localhost:9876 weitergeleitet — der Token wird automatisch angezeigt.\n');

// Start local server to catch the callback
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:9876');
  
  if (url.pathname === '/callback') {
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    
    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h1>Fehler: ${error}</h1>`);
      server.close();
      return;
    }
    
    if (code) {
      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });
      
      const tokens = await tokenResponse.json();
      
      if (tokens.refresh_token) {
        console.log('\n✅ SUCCESS! Refresh Token erhalten:');
        console.log('\nGOOGLE_DRIVE_REFRESH_TOKEN=' + tokens.refresh_token);
        console.log('\nKopiere diesen Wert und trage ihn als Secret ein.\n');
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html><body style="font-family:sans-serif;padding:40px;background:#1a1a1a;color:#fff">
          <h1 style="color:#22c55e">✅ Erfolg!</h1>
          <p>Refresh Token erhalten. Schau in die Konsole für den Token-Wert.</p>
          <p style="background:#333;padding:16px;border-radius:8px;word-break:break-all;font-family:monospace">
            ${tokens.refresh_token}
          </p>
          <p>Kopiere diesen Token und trage ihn als <strong>GOOGLE_DRIVE_REFRESH_TOKEN</strong> Secret ein.</p>
          </body></html>
        `);
      } else {
        console.error('\n❌ Fehler beim Token-Austausch:', tokens);
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>Fehler</h1><pre>${JSON.stringify(tokens, null, 2)}</pre>`);
      }
      
      setTimeout(() => server.close(), 2000);
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(9876, () => {
  console.log('Warte auf Callback auf Port 9876...\n');
});
