import express from "express";
import session from "express-session";
import methodOverride from "method-override";
import passport from "passport";
import path from "node:path";

import { env } from "./config/env.js";
import { attachViewLocals } from "./middleware/viewLocals.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { publicRouter } from "./routes/public.js";

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(
  session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      sameSite: "lax",
      secure: false,
    },
  }),
);
app.use(passport.initialize());
app.use(passport.session());
app.use(attachViewLocals);
app.use(express.static(path.join(process.cwd(), "public")));

app.use("/", publicRouter);
app.use("/auth", authRouter);
app.use("/admin", adminRouter);

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).render("error", {
    message: error.message || "Something went wrong.",
  });
});

export { app };
