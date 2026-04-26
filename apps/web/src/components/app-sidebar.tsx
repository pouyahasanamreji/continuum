"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { ProjectSwitcher } from "@/components/panel/ProjectSwitcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  ScrollTextIcon,
  BookOpenIcon,
  UsersIcon,
  FolderKanbanIcon,
} from "lucide-react"

const data = {
  user: {
    name: "orchestrator",
    email: "automationteam@sigmatelecom.com",
    avatar: "",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: <LayoutDashboardIcon />,
      isActive: false,
    },
    {
      title: "Projects",
      url: "/projects",
      icon: <FolderKanbanIcon />,
      isActive: false,
    },
    {
      title: "PLOT",
      url: "/plot",
      icon: <ScrollTextIcon />,
      isActive: false,
    },
    {
      title: "Knowledge",
      url: "/knowledge",
      icon: <BookOpenIcon />,
      isActive: false,
    },
    {
      title: "Agents",
      url: "/agents",
      icon: <UsersIcon />,
      isActive: false,
    },
  ],
}

export function AppSidebar({
  activeRoute,
  ...props
}: React.ComponentProps<typeof Sidebar> & { activeRoute?: string }) {
  const navItemsWithActive = data.navMain.map((item) => ({
    ...item,
    isActive: item.url === activeRoute,
  }))
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <ProjectSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItemsWithActive} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
