const dir = import.meta.dir + '/dist';
Bun.serve({ port: Number(process.env.PORT) || 8080, fetch(req) {
  let p = new URL(req.url).pathname; if (p.endsWith('/')) p += 'index.html';
  const f = Bun.file(dir + p); return f.exists().then((ok) => ok ? new Response(f) : new Response('nf', { status: 404 }));
} });
console.log('http://localhost:' + (process.env.PORT || 8080));
