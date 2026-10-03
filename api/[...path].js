const ALLOWED_IMAGE_HOST = 'cdninstagram.com';
const MAX_IMAGE_SIZE = 15 * 1024 * 1024;
const INSTAGRAM_ACCOUNT = 'tamanmadyajetisyogya1956';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method tidak diizinkan' });
  }

  let pathname;
  try {
    pathname = new URL(req.url, 'https://vercel.local').pathname;
  } catch {
    return res.status(400).json({ error: 'Path API tidak valid' });
  }

  if (pathname === '/api/instagram') {
    return handleInstagram(req, res);
  }

  if (pathname === '/api/instagram-image') {
    return handleInstagramImage(req, res);
  }

  return res.status(404).json({ error: 'Endpoint tidak ditemukan' });
};

async function handleInstagram(req, res) {
  const username = typeof req.query.username === 'string'
    ? req.query.username
    : INSTAGRAM_ACCOUNT;

  if (!/^[A-Za-z0-9._]+$/.test(username)) {
    return res.status(400).json({ error: 'Nama akun tidak valid' });
  }

  try {
    const apiUrl = `https://api-ig-ruddy.vercel.app/api/berita/sekolah/${encodeURIComponent(username)}`;
    const upstream = await fetch(apiUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    const body = await upstream.text();

    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') || 'application/json; charset=utf-8'
    );
    return res.status(upstream.status).send(body);
  } catch {
    return res.status(502).json({ error: 'Gagal mengambil data Instagram' });
  }
}

async function handleInstagramImage(req, res) {
  const requestedUrl = typeof req.query.url === 'string' ? req.query.url : '';
  let imageUrl;

  try {
    imageUrl = new URL(requestedUrl);
  } catch {
    return res.status(400).json({ error: 'URL gambar tidak valid' });
  }

  const hostname = imageUrl.hostname.toLowerCase();
  const isAllowedHost = hostname === ALLOWED_IMAGE_HOST || hostname.endsWith(`.${ALLOWED_IMAGE_HOST}`);

  if (imageUrl.protocol !== 'https:' || imageUrl.port || imageUrl.username || imageUrl.password || !isAllowedHost) {
    return res.status(400).json({ error: 'URL gambar tidak diizinkan' });
  }

  try {
    const upstream = await fetch(imageUrl.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'Gambar tidak dapat diambil' });
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return res.status(502).json({ error: 'Respons bukan gambar' });
    }

    const contentLength = Number(upstream.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_SIZE) {
      return res.status(413).json({ error: 'Ukuran gambar terlalu besar' });
    }

    const imageBytes = Buffer.from(await upstream.arrayBuffer());
    if (imageBytes.length > MAX_IMAGE_SIZE) {
      return res.status(413).json({ error: 'Ukuran gambar terlalu besar' });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(imageBytes);
  } catch {
    return res.status(502).json({ error: 'Gagal mengambil gambar Instagram' });
  }
}