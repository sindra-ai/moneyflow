"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import type { Outgoing } from "@/lib/types";
import HomeView from "./HomeView";
import CalendarView from "./CalendarView";
import ProfileView from "./ProfileView";
import BottomNav, { Tab } from "./BottomNav";
import ItemEditor from "./ItemEditor";
import LoginScreen from "./LoginScreen";
import { Plus } from "./icons";

export type EditorTarget =
  | { mode: "add"; presetDay?: number | null }
  | { mode: "edit"; item: Outgoing };

export default function AppShell() {
  const { hydrated } = useStore();
  const { session, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("home");
  const [editor, setEditor] = useState<EditorTarget | null>(null);

  const openAdd = (presetDay?: number | null) => setEditor({ mode: "add", presetDay });
  const openEdit = (item: Outgoing) => setEditor({ mode: "edit", item });

  return (
    <div className="app">
      <div className="bg" aria-hidden>
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
      </div>

      {loading || !hydrated ? (
        <div className="splash">
          <div className="spinner" />
        </div>
      ) : !session ? (
        <LoginScreen />
      ) : (
        <>
          <motion.div
            key={tab}
            className="scene"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === "home" && (
              <HomeView openAdd={openAdd} openEdit={openEdit} onTab={setTab} />
            )}
            {tab === "calendar" && <CalendarView openAdd={openAdd} openEdit={openEdit} />}
            {tab === "profile" && <ProfileView />}
          </motion.div>

          {(tab === "home" || tab === "calendar") && (
            <button
              className="fab"
              aria-label="Add outgoing"
              onClick={() => openAdd()}
            >
              <Plus size={26} strokeWidth={2.6} />
            </button>
          )}

          <BottomNav tab={tab} onChange={setTab} />

          {editor && (
            <ItemEditor target={editor} onClose={() => setEditor(null)} />
          )}
        </>
      )}
    </div>
  );
}
