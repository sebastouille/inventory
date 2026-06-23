import { render, screen } from "@testing-library/react";
import { LoginCard } from "@/components/login-card";

describe("LoginCard", () => {
  it("does not render demo credentials by default", () => {
    render(<LoginCard onLoggedIn={() => undefined} />);
    expect(screen.getByText("Acces espace terrain")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("demo-org")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("admin@demo.local")).not.toBeInTheDocument();
  });
});
