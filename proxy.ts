import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const STAFF_HOME = "/dashboard";
const PARENT_HOME = "/tabungan";

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;

  if (!user) {
    if (path === "/login") return res;
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = profile?.role as string | undefined;

  if (!role) {
    if (path === "/login") return res;
    return NextResponse.redirect(new URL("/login?error=profil", req.url));
  }

  if (path === "/" || path === "/login") {
    return NextResponse.redirect(
      new URL(role === "orangtua" ? PARENT_HOME : STAFF_HOME, req.url)
    );
  }
  if (role === "orangtua" && path !== PARENT_HOME) {
    return NextResponse.redirect(new URL(PARENT_HOME, req.url));
  }
  if (role !== "orangtua" && path === PARENT_HOME) {
    return NextResponse.redirect(new URL(STAFF_HOME, req.url));
  }
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
