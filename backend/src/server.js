import "dotenv/config";
import express from "express";
import cors from "cors";
import { runMigrations } from "./db/migrations.js";
import authRoutes from "./routes/auth.js";
import requestRoutes from "./routes/requests.js";
import adoptionRoutes from "./routes/adoptions.js";
import scheduleRoutes from "./routes/schedule.js";
import configRoutes from "./routes/config.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/adoptions", adoptionRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/config", configRoutes);

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;

runMigrations()
  .then(() => app.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`)))
  .catch((err) => { console.error("Erro ao iniciar:", err); process.exit(1); });
