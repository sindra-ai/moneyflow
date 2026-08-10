"use client";

import React from "react";
import { motion } from "framer-motion";
import type { Outgoing } from "@/lib/types";
import RowContent from "./RowContent";

export default function ItemRow({
  item,
  onToggle,
  onEdit,
}: {
  item: Outgoing;
  onToggle: () => void;
  onEdit: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: -10, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      className={"row" + (item.paid ? " paid" : "")}
    >
      <RowContent item={item} onToggle={onToggle} onEdit={onEdit} />
    </motion.div>
  );
}
