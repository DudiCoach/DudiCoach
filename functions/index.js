const { onRequest } = require("firebase-functions/v2/https");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";

// Next.js app — dir points to function root where .next/ and next.config.ts are copied
const nextApp = next({ dev, dir: __dirname });
const handle = nextApp.getRequestHandler();

exports.ssr = onRequest(
  {
    memory: "512MiB",
    timeoutSeconds: 60,
    ingressSettings: "ALLOW_ALL",
  },
  (req, res) => {
    return nextApp.prepare().then(() => handle(req, res));
  }
);
