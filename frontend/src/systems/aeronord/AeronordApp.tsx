import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@aeronord/components/ui/toaster";
import Convenios from "@aeronord/pages/Convenios";
import Recibo from "@aeronord/pages/Recibo";
import NotFound from "@aeronord/pages/NotFound";

export default function AeronordApp() {
  return (
    <div className="aeronord-root">
      <Toaster />
      <Routes>
        <Route index element={<Navigate to="cv" replace />} />
        <Route path="cv" element={<Convenios />} />
        <Route path="recibo/:id" element={<Recibo />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}
