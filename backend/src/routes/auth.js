import { Router } from "express";
import { auth, restrictedAuth } from "../middleware/auth.js";
import { login, me, changePassword } from "../services/auth/session-handlers.js";
import { forgotPassword, resetPassword } from "../services/auth/recovery-handlers.js";
import { profile, requestContactChallenge, confirmContactChallenge } from "../services/auth/profile-handlers.js";
import { searchTutors, assistedRecovery } from "../services/auth/assisted-recovery-handlers.js";
import { upsertInternalUser } from "../services/auth/internal-user-handlers.js";

const router = Router();
const endpoint = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
router.post("/login", endpoint(login));
router.get("/me", restrictedAuth, endpoint(me));
router.post("/change-password", restrictedAuth, endpoint(changePassword));
router.post("/forgot-password", endpoint(forgotPassword));
router.post("/reset-password", endpoint(resetPassword));
router.put("/users", auth, endpoint(upsertInternalUser));
router.get("/tutor/profile", auth, endpoint(profile));
router.post("/tutor/contact-challenges", auth, endpoint(requestContactChallenge));
router.post("/tutor/contact-challenges/:id/confirm", auth, endpoint(confirmContactChallenge));
router.get("/tutors", auth, endpoint(searchTutors));
router.post("/tutors/:id/assisted-recovery", auth, endpoint(assistedRecovery));
router.use((error, _req, res, _next) => {
  const status = error.code === "23505" ? 409 : error.status || 500;
  res.status(status).set("Cache-Control", "no-store").json({
    error: status === 409 && error.code === "23505" ? "Esta identidade já está cadastrada."
      : error.status ? error.message : "Não foi possível concluir a operação de autenticação.",
    ...(error.status && error.code ? { code: error.code } : {}),
  });
});
export default router;
