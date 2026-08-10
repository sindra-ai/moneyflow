"use client";

import React from "react";
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
  return (
    <Reorder.Item
      value={item}
      as="div"
      dragListener={false}
      dragControls={controls}
      className={"row" + (item.paid ? " paid" : "")}
      whileDrag={{
        scale: 1.03,
        boxShadow: "0 20px 44px -14px rgba(0,0,0,0.7)",
        cursor: "grabbing",
      }}
      transition={{ type: "spring", stiffness: 550, damping: 42 }}
    >
      <RowContent
        item={item}
        onToggle={onToggle}
        onEdit={onEdit}
        dragHandle={(e) => controls.start(e)}
      />
    </Reorder.Item>
  );
}
