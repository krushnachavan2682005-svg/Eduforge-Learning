const Fastify = require('fastify');
const { AsyncLocalStorage } = require('async_hooks');
const http = require('http');

const cls = new AsyncLocalStorage();
const app = Fastify();

app.addHook("onRequest", (req, reply, done) => {
  cls.run({ id: 123 }, done);
});

app.get('/test', async (req, reply) => {
  const store = cls.getStore();
  return { store: store || null };
});

app.listen({ port: 3002 }, (err) => {
  if (err) throw err;
  
  http.get('http://localhost:3002/test', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Result run(done):', data);
      
      // Try enterWith
      const app2 = Fastify();
      app2.addHook("onRequest", (req, reply, done) => {
        cls.enterWith({ id: 999 });
        done();
      });
      app2.get('/test', async (req, reply) => {
        const store = cls.getStore();
        return { store: store || null };
      });
      app2.listen({ port: 3003 }, (err) => {
        http.get('http://localhost:3003/test', (res) => {
          let data2 = '';
          res.on('data', chunk => data2 += chunk);
          res.on('end', () => {
            console.log('Result enterWith:', data2);
            process.exit(0);
          });
        });
      });
    });
  });
});
