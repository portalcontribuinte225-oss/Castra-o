import "./env.js";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { runMigrations } from "./db/migrations.js";
import authRoutes from "./routes/auth.js";
import requestRoutes from "./routes/requests.js";
import adoptionRoutes from "./routes/adoptions.js";
import scheduleRoutes from "./routes/schedule.js";
import configRoutes from "./routes/config.js";
import aiRoutes from "./routes/ai.js";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, "../../dist");

app.use(cors());
app.use(express.json({ limit: "16mb" }));
app.use(express.urlencoded({ extended: true, limit: "16mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/adoptions", adoptionRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/config", configRoutes);
app.use("/api/ai", aiRoutes);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use(express.static(distPath));
app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));

const PORT = process.env.PORT || 3002;

runMigrations()
  .then(() => app.listen(PORT, () => console.log(`App rodando em http://localhost:${PORT}`)))
  .catch((err) => { console.error("Erro ao iniciar:", err); process.exit(1); });
