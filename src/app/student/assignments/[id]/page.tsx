"use client";

import { useParams } from "next/navigation";
import AssignmentView from "@/components/student/AssignmentView";

export default function StudentAssignmentPage() {
  const { id } = useParams<{ id: string }>();
  return <AssignmentView assignmentId={id} />;
}
