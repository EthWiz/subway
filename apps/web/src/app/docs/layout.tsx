import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { docsNav } from "@/lib/source";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[180px_minmax(0,1fr)]">
      <DocsSidebar items={docsNav()} />
      {children}
    </div>
  );
}
