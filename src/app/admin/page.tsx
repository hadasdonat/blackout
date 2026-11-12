import type { Metadata } from "next";
import { AdminDashboard } from "@/components/AdminDashboard";

export const metadata: Metadata = { title: "Blackout · ניהול", robots: { index: false } };
export default function AdminPage() { return <AdminDashboard />; }
