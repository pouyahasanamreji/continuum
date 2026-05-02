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
  Settings as SettingsIcon,
} from "lucide-react"
import { withBase } from "@/lib/base-path"

const data = {
  user: {
    name: "orchestrator",
    email: "automationteam@sigmatelecom.com",
    avatar: "",
  },
  navMain: [
    {
      title: "Dashboard",
      path: "/",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "Projects",
      path: "/projects",
      icon: <FolderKanbanIcon />,
    },
    {
      title: "PLOT",
      path: "/plot",
      icon: <ScrollTextIcon />,
    },
    {
      title: "Knowledge",
      path: "/knowledge",
      icon: <BookOpenIcon />,
    },
    {
      title: "Agents",
      path: "/agents",
      icon: <UsersIcon />,
    },
    {
      title: "Settings",
      path: "/settings",
      icon: <SettingsIcon />,
    },
  ],
}

export function AppSidebar({
  activeRoute,
  ...props
}: React.ComponentProps<typeof Sidebar> & { activeRoute?: string }) {
  const navItemsWithActive = data.navMain.map((item) => ({
    title: item.title,
    icon: item.icon,
    url: withBase(item.path),
    isActive: item.path === activeRoute,
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
