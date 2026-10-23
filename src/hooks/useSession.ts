import { useCallback, useEffect, useState } from 'react';
import { appApi, isApiError, type AppUser } from '@/lib/app-api';

type SessionState = {
  user: AppUser | null;
  loading: boolean;
  error: string | null;
};

/**
 * 会话状态。
 *
 * 没有全局 store：账号只在 /account 与后台用到，用 hook 就地拉取比引 Context 更简单，
 * 也避免给全站塞一个永远要发请求的 Provider。
 */
export function useSession() {
  const [state, setState] = useState<SessionState>({ user: null, loading: true, error: null });

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const user = await appApi.me();
      setState({ user, loading: false, error: null });
      return user;
    } catch (error) {
      setState({
        user: null,
        loading: false,
        error: isApiError(error) ? error.message : '无法连接服务，请稍后再试。',
      });
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const user = await appApi.login({ email, password });
    setState({ user, loading: false, error: null });
    return user;
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const user = await appApi.register({ email, password, displayName });
      setState({ user, loading: false, error: null });
      return user;
    },
    [],
  );

  const logout = useCallback(async () => {
    await appApi.logout();
    setState({ user: null, loading: false, error: null });
  }, []);

  return { ...state, refresh, login, register, logout };
}
