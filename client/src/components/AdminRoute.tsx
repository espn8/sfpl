import { useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { Navigate } from "react-router-dom";
import { fetchMe } from "../features/auth/api";
import { canAccessAdminUi } from "../features/auth/roles";

type AdminRouteProps = {
  children: React.ReactNode;
};

export function AdminRoute({ children }: AdminRouteProps) {
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    retry: false,
  });

  if (meQuery.isLoading) {
    return <p className="p-8">Loading session...</p>;
  }

  if (meQuery.error instanceof AxiosError && meQuery.error.response?.status === 401) {
    return <Navigate to="/login" replace />;
  }

  if (meQuery.error) {
    return <p className="p-8 text-red-700">Authentication check failed.</p>;
  }

  if (!meQuery.data || !canAccessAdminUi(meQuery.data.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
