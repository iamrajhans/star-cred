import { useCallback, useState } from "react";
import { validateToken } from "../lib/github";

const STORAGE_KEY = "ghss.token";
const LOGIN_KEY = "ghss.login";

/** Manages the GitHub PAT: persistence in localStorage + validation. */
export function useToken() {
  const [token, setTokenState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const [login, setLogin] = useState<string | null>(
    () => localStorage.getItem(LOGIN_KEY)
  );
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveToken = useCallback(async (candidate: string) => {
    setValidating(true);
    setError(null);
    try {
      const userLogin = await validateToken(candidate);
      localStorage.setItem(STORAGE_KEY, candidate);
      localStorage.setItem(LOGIN_KEY, userLogin);
      setTokenState(candidate);
      setLogin(userLogin);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to validate token.");
      return false;
    } finally {
      setValidating(false);
    }
  }, []);

  const clearToken = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LOGIN_KEY);
    setTokenState(null);
    setLogin(null);
    setError(null);
  }, []);

  return { token, login, validating, error, saveToken, clearToken };
}
