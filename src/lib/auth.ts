export const workspaceEmail = "bniventures@gmail.com";

export function isWorkspaceAccount(email: string | undefined) {
  return email?.toLowerCase() === workspaceEmail;
}
