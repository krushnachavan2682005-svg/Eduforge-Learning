const Fastify = require('fastify');
const { AsyncLocalStorage } = require('async_hooks');

const cls = new AsyncLocalStorage();

const app = Fastify();

app.addHook("onRequest", (req, reply, done) => {
  cls.run({ id: 123 }, () => {
    done();
  });
});

app.get('/test', async (req, reply) => {
  const store = cls.getStore();
  return { store };
});

app.listen({ port: 3001 }, (err) => {
  if (err) throw err;
  console.log('Server started on 3001');
});
