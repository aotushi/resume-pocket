import { getCurrentUser } from "./lib/auth";
import { Workspace } from "./workspace";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  return <Workspace user={user ? { name: user.name } : null} />;
}
