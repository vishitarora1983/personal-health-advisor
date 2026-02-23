// Landing page layout — intentionally minimal.
// No Sidebar, no AuthGate, no ProfileProvider.
// The landing page is public-facing and must not include any app-specific chrome.

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
