import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("conflicts", "routes/conflicts.tsx"),
  route("about", "routes/about.tsx"),
  route("conflicts/:id", "routes/conflicts.$id.tsx"),
  route("admin/login", "routes/admin.login.tsx"),
  route("admin/sources", "routes/admin.sources.tsx"),
] satisfies RouteConfig;
