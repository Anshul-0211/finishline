import { redirect } from "next/navigation";

export default function GmailRedirectPage() {
  redirect("/dashboard/add?tab=gmail");
}
