import { redirect } from "next/navigation";

/**
 * Root page — redirects to /login.
 * Authenticated users will be sent to /dashboard by the login page.
 */
export default function RootPage() {
  redirect("/login");
}
