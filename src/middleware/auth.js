export function requireAdmin(request, response, next) {
  if (request.isAuthenticated?.() && request.user?.role === "ADMIN") {
    return next();
  }

  response.redirect("/auth/microsoft");
}
