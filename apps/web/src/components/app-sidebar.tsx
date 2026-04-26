"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  GalleryVerticalEndIcon,
  LayoutDashboardIcon,
  ScrollTextIcon,
  BookOpenIcon,
  UsersIcon,
} from "lucide-react"

const data = {
  user: {
    name: "orchestrator",
    email: "automationteam@sigmatelecom.com",
    avatar: "",
  },
  teams: [
    {
      name: "Continuum",
      logo: <GalleryVerticalEndIcon />,
      plan: "dev",
    },
  ],
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: <LayoutDashboardIcon />,
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
        <TeamSwitcher teams={data.teams} />
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
