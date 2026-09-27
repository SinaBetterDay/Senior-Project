import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("about", "routes/about.tsx"),
  route("admin/login", "routes/admin.login.tsx"),
  route("admin/sources", "routes/admin.sources.tsx"),
  route("admin/upload", "routes/admin.upload.tsx"),
  route("admin/politicians", "routes/admin.politicians.tsx"),
  route("politicians/:slug", "routes/politician.profile.tsx"),
] satisfies RouteConfig;