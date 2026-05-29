import { redirect } from "next/navigation";

/** Legacy route — project setup lives in Workspace tab 1. */
export default function ProjectSetupRedirectPage() {
  redirect("/workspace?tab=setup");
}
