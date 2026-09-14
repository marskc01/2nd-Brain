export function routeIntent(note?: string) {
  const n = (note ?? "").toLowerCase();
  if (/^\/save\b/.test(n) || n.includes("just save")) return "save_reference";
  if (/^\/research\b/.test(n) || n.includes("research") || n.includes("verify"))
    return "research";
  if (/^\/compare\b/.test(n) || n.includes("compare")) return "comparison";
  if (
    /^\/experiment\b/.test(n) ||
    n.includes("experiment") ||
    n.includes("service")
  )
    return "experiment";
  if (/^\/script\b/.test(n) || n.includes("script")) return "script";
  if (/^\/project\b/.test(n) || n.includes("add this to"))
    return "update_project";
  return "understand_connect";
}
