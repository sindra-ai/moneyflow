"use client";

import React from "react";
import { Reorder } from "framer-motion";
import type { Outgoing } from "@/lib/types";
import RowContent from "./RowContent";

export default function ReorderRow({
  item,
  onToggle,
  onEdit,
  active,
}: {
  item: Outgoing;
  onToggle: () => void;
  onEdit: () => void;
  active: boolean;
}) {
  return (
    <Reorder.Item
      value={item}
      as="div"
      dragListener={active}
      className={"row" + (item.paid ? " paid" : "") + (active ? " reordering" : "")}
      whileDrag={{
        scale: 1.03,
        boxShadow: "0 22px 46px -14px rgba(0,0,0,0.7)",
        cursor: "grabbing",
        zIndex: 6,
      }}
      transition={{ type: "spring", stiffness: 550, damping: 42 }}
    >
      <RowContent item={item} onToggle={onToggle} onEdit={onEdit} showGrip={active} />
    </Reorder.Item>
  );
}
