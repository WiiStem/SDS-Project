export function attachViewLocals(request, response, next) {
  response.locals.currentUser = request.user ?? null;
  response.locals.isAdmin =
    request.isAuthenticated?.() && request.user?.role === "ADMIN";
  response.locals.path = request.path;
  response.locals.query = request.query;
  next();
}
