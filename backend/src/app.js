import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env, corsReflectOrigin, frontendOrigins } from "./config/env.js";
import authRoutes from "./modules/auth/auth.routes.js";
import sensorRoutes from "./modules/sensor/sensor.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";
import sheetsRoutes from "./modules/sheets/sheets.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

export function createApp() {
  const app = express();

  if (corsReflectOrigin && env.nodeEnv === "production") {
    // eslint-disable-next-line no-console
    console.warn(
      "[cors] FRONTEND_URL is unset — allowing any Origin (reflect). Set FRONTEND_URL=https://your-site for a strict allowlist."
    );
  }

  app.use(
    cors({
      credentials: true,
      origin: corsReflectOrigin
        ? true
        : (origin, cb) => {
            if (!origin) return cb(null, true);
            return cb(null, frontendOrigins.includes(origin));
          },
    })
  );
  app.use(express.json({ limit: "12mb" }));
  app.use(cookieParser());

  app.get("/api/health", (req, res) => {
    res.json({ ok: true, environment: env.nodeEnv });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api", sensorRoutes);
  app.use("/api", analyticsRoutes);
  app.use("/api", sheetsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
