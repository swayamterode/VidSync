import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  }),
);

app.use(
  express.json({
    limit: "16kb",
  }),
);

app.use(express.urlencoded({ extended: true, limit: "16kb" })); // Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.static("public")); // for images and favicon

export { app };
