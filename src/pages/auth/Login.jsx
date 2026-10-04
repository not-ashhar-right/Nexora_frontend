import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import { useAuth } from "../../context/AuthContext";
import { loginUser } from "../../services/authService";
import { ROUTES } from "../../routes/routeConfig";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const getDashboardRoute = (role) => {
    const normalizedRole = String(role || "").toLowerCase();

    if (normalizedRole === "merchant") {
      return ROUTES.MERCHANT.DASHBOARD;
    }

    if (normalizedRole === "supplier") {
      return ROUTES.SUPPLIER.DASHBOARD;
    }

    if (normalizedRole === "admin") {
      return ROUTES.ADMIN.DASHBOARD;
    }

    return ROUTES.HOME;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await loginUser(formData);

      const user = response?.user || response?.data?.user;
      const token =
        response?.accessToken ||
        response?.token ||
        response?.data?.accessToken ||
        response?.data?.token;

      if (!user || !token) {
        throw new Error("Invalid login response from server.");
      }

      login(user, token);

      const destination =
        location.state?.from?.pathname ||
        getDashboardRoute(user.role);

      navigate(destination, { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          "Unable to login. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Welcome back</h1>
          <p>Sign in to your merchant network account.</p>
        </div>

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <Input
            label="Email"
            name="email"
            type="email"
            placeholder="Enter your email"
            value={formData.email}
            onChange={handleChange}
            required
          />

          <Input
            label="Password"
            name="password"
            type="password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleChange}
            required
          />

          <Button
            type="submit"
            fullWidth
            loading={loading}
          >
            Sign In
          </Button>
        </form>



        <div className="auth-footer">
          <span>Don't have an account?</span>{" "}
          <button
            type="button"
            className="auth-link"
            onClick={() => navigate(ROUTES.AUTH.REGISTER)}
          >
            Create account
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;