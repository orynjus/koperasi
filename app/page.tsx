import { redirect } from "next/navigation";

export default function Home() {
  // Proxy mengarahkan ke halaman yang sesuai peran.
  redirect("/dashboard");
}
