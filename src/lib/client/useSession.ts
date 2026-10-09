"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getMe, hasSession, homeFor, type Role, type User } from "./api";

/**
 * The signed-in user, once confirmed. Sends visitors without a session back to
 * the login page, and users of the other role to their own home.
 */
export function useSession(role: Role): User | null {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!hasSession()) {
      router.replace("/");
      return;
    }
    getMe()
      .then((me) => {
        if (me.role !== role) router.replace(homeFor(me.role));
        else setUser(me);
      })
      .catch(() => router.replace("/"));
  }, [role, router]);

  return user;
}
