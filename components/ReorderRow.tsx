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
  const blocking = useRef(false);

  // While dragging, stop the browser from scrolling the list (which is what
  // was stealing the gesture and making the row not follow the finger).
  const blockScroll = (ev: TouchEvent) => {
    if (ev.cancelable) ev.preventDefault();
  };
  const stopBlocking = () => {
    if (blocking.current) {
      document.removeEventListener("touchmove", blockScroll, { capture: true } as EventListenerOptions);
      blocking.current = false;
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const sx = e.clientX;
    const sy = e.clientY;
    const native = e.nativeEvent;
    const scroller = (e.currentTarget as HTMLElement).closest(".view-scroll");

    const cancelWait = () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("touchmove", onTouchMove, true);
      window.removeEventListener("pointerup", cancelWait, true);
      window.removeEventListener("pointercancel", cancelWait, true);
      scroller?.removeEventListener("scroll", cancelWait);
    };
    const movedFar = (x: number, y: number) =>
      Math.abs(x - sx) > 8 || Math.abs(y - sy) > 8;
    const onMove = (ev: PointerEvent) => {
      if (movedFar(ev.clientX, ev.clientY)) cancelWait();
    };
    const onTouchMove = (ev: TouchEvent) => {
      const t = ev.touches[0];
      if (t && movedFar(t.clientX, t.clientY)) cancelWait();
    };

    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("touchmove", onTouchMove, true);
    window.addEventListener("pointerup", cancelWait, true);
    window.addEventListener("pointercancel", cancelWait, true);
    scroller?.addEventListener("scroll", cancelWait, { passive: true });

    timer.current = window.setTimeout(() => {
      cancelWait(); // stop watching for scroll/move
      blocking.current = true;
      document.addEventListener("touchmove", blockScroll, { passive: false, capture: true });
      document.addEventListener("pointerup", stopBlocking, { capture: true, once: true });
      document.addEventListener("pointercancel", stopBlocking, { capture: true, once: true });
      controls.start(native);
    }, 240);
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
      onDragEnd={stopBlocking}
      whileDrag={{
        scale: 1.03,
        boxShadow: "0 22px 46px -14px rgba(0,0,0,0.7)",
        cursor: "grabbing",
        zIndex: 6,
      }}
      transition={{ type: "spring", stiffness: 550, damping: 42 }}
    >
      <RowContent item={item} onToggle={onToggle} onEdit={onEdit} />
    </Reorder.Item>
  );
}
