import { Router } from "express";
import passport from "passport";
import { Strategy as MicrosoftStrategy } from "passport-microsoft";

import { adminEmails, env, microsoftConfigured } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

const authRouter = Router();

if (microsoftConfigured) {
  passport.serializeUser((user, done) => done(null, user.microsoftId));
  passport.deserializeUser(async (microsoftId, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { microsoftId } });
      done(null, user ?? false);
    } catch (error) {
      done(error);
    }
  });

  passport.use(
    new MicrosoftStrategy(
      {
        clientID: env.MICROSOFT_CLIENT_ID,
        clientSecret: env.MICROSOFT_CLIENT_SECRET,
        callbackURL: `${env.APP_URL}${env.MICROSOFT_CALLBACK_PATH}`,
        scope: ["user.read"],
        tenant: env.MICROSOFT_TENANT_ID,
        authorizationURL: `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`,
        tokenURL: `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();

          if (!email || (adminEmails.length && !adminEmails.includes(email))) {
            console.log(
              "This account is not allowed. The following email is not associated to an admin.",
            );
            console.log(email);
            return done(null, false, {
              message: "This account is not allowed.",
            });
          }

          const user = await prisma.user.upsert({
            where: { microsoftId: profile.id },
            update: { email },
            create: {
              microsoftId: profile.id,
              email,
              role: "ADMIN",
            },
          });

          done(null, user);
        } catch (error) {
          done(error);
        }
      },
    ),
  );
}

authRouter.get("/microsoft", (request, response, next) => {
  if (!microsoftConfigured) {
    return response
      .status(503)
      .render("error", { message: "Microsoft auth is not configured yet." });
  }

  passport.authenticate("microsoft", {
    prompt: "select_account",
  })(request, response, next);
});

authRouter.get(
  "/microsoft/callback",
  passport.authenticate("microsoft", {
    failureRedirect: "/sds",
  }),
  (_request, response) => {
    response.redirect("/admin/sds");
  },
);

authRouter.post("/logout", (request, response, next) => {
  request.logout((error) => {
    if (error) {
      return next(error);
    }

    request.session.destroy(() => {
      response.redirect("/sds");
    });
  });
});

export { authRouter };
