export type Role = "owner" | "admin" | "member";

// The delegate admin only has admin powers while the owner has enabled them.
export function effectiveRole(user: { role: Role; delegateEnabled: boolean }): Role {
  if (user.role === "admin" && !user.delegateEnabled) return "member";
  return user.role;
}

export function canAdminister(role: Role): boolean {
  return role === "owner" || role === "admin";
}
