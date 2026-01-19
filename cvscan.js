// Load environment variables
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const https = require("https");
const fs = require("fs");
const resumeRoute = require("./router");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/scan", resumeRoute);
app.use("/uploads", express.static("uploads"));

// Home Page
app.get("/", (req, res) => {
  res.send(`
    <div style="text-align:center;margin-top:80px;font-family:Arial;">
      <h1 style="color:green;">REZOON DIGITAL ATS SCANNER</h1>
      <h2>POST → <code>/scan/resume</code></h2>
      <p><strong>Key:</strong> cv | <strong>Type:</strong> File | <strong>Accept:</strong> .pdf</p>
      <h3 style="color:red;">90+ ONLY WITH OFFICIAL REZOON TEMPLATE</h3>
    </div>
  `);
});

const PORT = 7005;

// SSL Configuration
const sslOptions = {
  key: process.env.SSL_PRIVATE_KEY ? safeRead(process.env.SSL_PRIVATE_KEY) : null,
  cert: process.env.SSL_CERTIFICATE ? safeRead(process.env.SSL_CERTIFICATE) : null,
  ca: process.env.SSL_CA_BUNDLE ? safeRead(process.env.SSL_CA_BUNDLE) : null,
};

function safeRead(path) {
  try {
    if (fs.existsSync(path)) {
      return fs.readFileSync(path);
    }
  } catch (e) {
    console.warn(`Could not read SSL file at ${path}`);
  }
  return null;
}

if (sslOptions.key && sslOptions.cert) {
  https.createServer(sslOptions, app).listen(PORT, () => {
    console.log(`\nREZOON DIGITAL ATS LIVE (HTTPS) → https://lunarsenterprises.com:${PORT}`);
    console.log(`Upload CV → POST /scan/resume (form-data, key: cv)\n`);
  });
} else {
  app.listen(PORT, () => {
    console.log(`\nREZOON DIGITAL ATS LIVE (HTTP) → http://localhost:${PORT}`);
    console.log("SSL keys not found or invalid, falling back to HTTP.");
    console.log(`Upload CV → POST /scan/resume (form-data, key: cv)\n`);
  });
}