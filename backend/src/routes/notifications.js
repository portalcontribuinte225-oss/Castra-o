import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { listNotifications, openNotification } from "../services/staff-notification-handlers.js";

const router = Router();

function staffNotificationEndpoint(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      res.status(error.status || 500).json({
        error: error.status ? error.message : "Não foi possível consultar as notificações.",
      });
    }
  };
}

router.get("/", auth, staffNotificationEndpoint(listNotifications));
router.post("/:id/read", auth, staffNotificationEndpoint(openNotification));

export default router;
