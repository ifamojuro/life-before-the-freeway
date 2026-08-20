import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "./components/Toast";
import { DeviceProvider } from "./lib/device";
import HomePage from "./pages/home/HomePage";

const StoryPage = lazy(() => import("./pages/story/StoryPage"));
const ContributePage = lazy(() => import("./pages/contribute/ContributePage"));
const ProjectPage = lazy(() => import("./pages/info/ProjectPage"));
const AboutI980Page = lazy(() => import("./pages/info/AboutI980Page"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLayout").then((m) => ({ default: m.AdminLogin })));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })));
const QueuePage = lazy(() => import("./pages/admin/QueuePage"));
const SubmissionDetailPage = lazy(() => import("./pages/admin/SubmissionDetailPage"));
const PublishedPage = lazy(() => import("./pages/admin/PublishedPage"));
const FieldCapturePage = lazy(() => import("./pages/admin/FieldCapturePage"));
const StaffPage = lazy(() => import("./pages/admin/StaffPage"));
const AuditPage = lazy(() => import("./pages/admin/AuditPage"));
const SettingsPage = lazy(() => import("./pages/admin/SettingsPage"));

function Fallback() {
  return <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><span className="spinner" /></div>;
}

export default function App() {
  return (
    <DeviceProvider>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<Fallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/story/:id" element={<StoryPage />} />
              <Route path="/contribute" element={<ContributePage />} />
              <Route path="/project" element={<ProjectPage />} />
              <Route path="/about-980" element={<AboutI980Page />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<QueuePage />} />
                <Route path="submissions/:id" element={<SubmissionDetailPage />} />
                <Route path="published" element={<PublishedPage />} />
                <Route path="field-capture" element={<FieldCapturePage />} />
                <Route path="staff" element={<StaffPage />} />
                <Route path="audit" element={<AuditPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </DeviceProvider>
  );
}
