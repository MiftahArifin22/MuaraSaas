import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isWorkspaceAccount } from "@/lib/auth";
import { supabaseConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Halaman workspace bergantung pada sesi pengguna, jadi tidak boleh disimpan di cache bersama.
  response.headers.set("Cache-Control", "private, no-store");
  const config = supabaseConfig();

  // Tanpa kredensial Supabase, workspace dibuka sebagai demo lokal dengan data fiktif di browser.
  if (!config) return response;

  function loginRedirect() {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user || !user.email_confirmed_at || !isWorkspaceAccount(user.email)) return loginRedirect();
  } catch {
    return loginRedirect();
  }
  return response;
}

export const config = { matcher: ["/dashboard/:path*"] };
