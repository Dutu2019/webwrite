"use client";

import { useParams } from "next/navigation";
import AssignmentBuilder from "@/components/builder/AssignmentBuilder";

export default function AssignmentBuilderPage() {
  const { id } = useParams<{ id: string }>();
  return <AssignmentBuilder assignmentId={id} />;
}
