import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/desk")({
  component: function DeskRedirect() {
    return <Navigate to="/" />;
  },
});
