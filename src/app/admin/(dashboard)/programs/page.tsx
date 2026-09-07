import { ProgramManager } from "@/features/programs/components/program-manager";
import { getAllPrograms } from "@/features/programs/queries";

export default async function AdminProgramsPage() {
  const programs = await getAllPrograms();
  return <ProgramManager programs={programs} />;
}