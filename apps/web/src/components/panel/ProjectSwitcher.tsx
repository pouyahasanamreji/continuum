import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  ChevronsUpDownIcon,
  FolderKanbanIcon,
  PlusIcon,
} from "lucide-react";
import { useActiveProject } from "@/lib/use-active-project";
import { useProjects } from "@/lib/use-projects";
import { setActiveProject } from "@/lib/active-project-store";
import { withBase } from "@/lib/base-path";
import type { ProjectFull } from "@/types/project";

export function ProjectSwitcher() {
  const { isMobile } = useSidebar();
  const activePath = useActiveProject();
  const { projects, loading } = useProjects();

  React.useEffect(() => {
    if (!projects || projects.length === 0) return;
    if (activePath && projects.some((p) => p.path === activePath)) return;
    setActiveProject(projects[0].path);
  }, [projects, activePath]);

  const active: ProjectFull | null =
    projects?.find((p) => p.path === activePath) ?? null;

  const handleSelect = (path: string) => {
    setActiveProject(path);
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <FolderKanbanIcon />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {active
                    ? active.name
                    : loading
                      ? "Loading..."
                      : "No project"}
                </span>
                <span className="truncate text-xs">
                  {active ? active.path : "Create your first project"}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-72 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Projects
            </DropdownMenuLabel>
            {projects && projects.length > 0 ? (
              projects.map((p) => (
                <DropdownMenuItem
                  key={p.path}
                  onClick={() => handleSelect(p.path)}
                  className="gap-2 p-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-md border">
                    <FolderKanbanIcon className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-xs leading-tight">
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="truncate text-muted-foreground">
                      {p.path}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled className="gap-2 p-2 text-xs">
                {loading ? "Loading..." : "No projects yet"}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2 p-2">
              <a href={withBase("/projects")}>
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <PlusIcon className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">
                  Manage projects
                </div>
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
