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
  const start = useRef({ x: 0, y: 0 });

  const clear = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  // Press-and-hold anywhere on the row to pick it up; a quick tap or a swipe
  // (which moves before the timer) does not start a drag.
  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
    clear();
    timer.current = window.setTimeout(() => controls.start(e), 260);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!timer.current) return;
    if (
      Math.abs(e.clientX - start.current.x) > 8 ||
      Math.abs(e.clientY - start.current.y) > 8
    ) {
      clear();
    }
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
      onPointerMove={onPointerMove}
      onPointerUp={clear}
      onPointerCancel={clear}
      onPointerLeave={clear}
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
