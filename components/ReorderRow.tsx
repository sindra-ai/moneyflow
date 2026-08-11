"use client";

import React, { useRef } from "react";
import { Reorder, useDragControls } from "framer-motion";
import type { Outgoing } from "@/lib/types";
import RowContent from "./RowContent";

export default function ReorderRow({
  item,
  onToggle,
  onEdit,
}: {
  item: Outgoing;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const controls = useDragControls();
  const timer = useRef<number | null>(null);

  // Press-and-hold anywhere on the row to pick it up. Any scroll or movement
  // before the hold completes cancels it — so a hold never hijacks a scroll
  // (which was leaving the scroll container stuck).
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const sx = e.clientX;
    const sy = e.clientY;
    const scroller = (e.currentTarget as HTMLElement).closest(".view-scroll");

    const cancel = () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("touchmove", onTouchMove, true);
      window.removeEventListener("pointerup", cancel, true);
      window.removeEventListener("pointercancel", cancel, true);
      scroller?.removeEventListener("scroll", cancel);
    };
    const onMove = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - sx) > 8 || Math.abs(ev.clientY - sy) > 8) cancel();
    };
    const onTouchMove = (ev: TouchEvent) => {
      const t = ev.touches[0];
      if (t && (Math.abs(t.clientX - sx) > 8 || Math.abs(t.clientY - sy) > 8)) cancel();
    };

    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("touchmove", onTouchMove, true);
    window.addEventListener("pointerup", cancel, true);
    window.addEventListener("pointercancel", cancel, true);
    scroller?.addEventListener("scroll", cancel, { passive: true });

    timer.current = window.setTimeout(() => {
      cancel();
      controls.start(e);
    }, 260);
  };

  return (
    <Reorder.Item
      value={item}
      as="div"
      dragListener={false}
      dragControls={controls}
      className={"row" + (item.paid ? " paid" : "")}
      style={{ touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      whileDrag={{
        scale: 1.03,
        boxShadow: "0 20px 44px -14px rgba(0,0,0,0.7)",
        cursor: "grabbing",
      }}
      transition={{ type: "spring", stiffness: 550, damping: 42 }}
    >
      <RowContent item={item} onToggle={onToggle} onEdit={onEdit} />
    </Reorder.Item>
  );
}
