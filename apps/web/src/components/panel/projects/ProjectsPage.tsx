import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectsTable } from "./ProjectsTable";
import { columns } from "./columns";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { RenameProjectDialog } from "./RenameProjectDialog";
import { DeleteProjectAlert } from "./DeleteProjectAlert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProjects } from "@/lib/use-projects";
import { setActiveProject } from "@/lib/active-project-store";
import { useActiveProject } from "@/lib/use-active-project";
import { PlusIcon } from "lucide-react";
import type { ProjectFull } from "@/types/project";

export function ProjectsPage() {
  const { projects, loading, error, refresh } = useProjects();
  const activePath = useActiveProject();
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<ProjectFull | null>(null);
  const [renaming, setRenaming] = useState<ProjectFull | null>(null);
  const [deleting, setDeleting] = useState<ProjectFull | null>(null);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Failed to load projects</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Projects</h2>
          <p className="text-sm text-muted-foreground">
            Each project is keyed by canonical absolute path.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon className="mr-2 size-4" />
            New project
          </Button>
        </div>
      </div>

      {loading && projects === null ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <ProjectsTable
          columns={columns}
          data={projects ?? []}
          onRowClick={setSelected}
        />
      )}

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(p) => {
          setActiveProject(p.path);
          void refresh();
        }}
      />

      <RenameProjectDialog
        project={renaming}
        onOpenChange={(o) => !o && setRenaming(null)}
        onRenamed={() => void refresh()}
      />

      <DeleteProjectAlert
        project={deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        onDeleted={() => void refresh()}
      />

      <Dialog
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>
              <span className="font-mono text-xs">{selected?.path}</span>
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Created:</span>{" "}
                {new Date(selected.createdAt).toLocaleString()}
              </div>
              <div>
                <span className="text-muted-foreground">Updated:</span>{" "}
                {new Date(selected.updatedAt).toLocaleString()}
              </div>
              {activePath === selected.path ? (
                <p className="text-xs text-muted-foreground">
                  Currently the active project.
                </p>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setActiveProject(selected.path);
                    setSelected(null);
                  }}
                >
                  Make active
                </Button>
              )}
            </div>
          ) : null}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (selected) {
                  setRenaming(selected);
                  setSelected(null);
                }
              }}
            >
              Rename
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selected) {
                  setDeleting(selected);
                  setSelected(null);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
