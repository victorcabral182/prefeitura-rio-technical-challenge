import { createServer } from 'node:http';

const port = Number(process.env.PORT ?? 9100);

// Por enquanto só /health. O consumidor RabbitMQ e o /metrics entram nas próximas etapas.
const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' }).end('{"status":"ok"}');
    return;
  }
  res.writeHead(404).end();
});

server.listen(port, () => console.log(`worker ouvindo na porta ${port}`));

process.on('SIGTERM', () => server.close(() => process.exit(0)));
