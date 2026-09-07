"use client";

import {
  CalendarDaysIcon,
  CalendarIcon,
  ChevronDownIcon,
  ImageIcon,
  MegaphoneIcon,
  PlusIcon,
} from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";

import { Button } from "@/components/ui/button";

const CREATE_ACTIONS = [
  {
    label: "Add banner",
    href: "/admin/banners?create=1",
    icon: ImageIcon,
  },
  {
    label: "Create program",
    href: "/admin/programs?create=1",
    icon: CalendarDaysIcon,
  },
  {
    label: "Post announcement",
    href: "/admin/announcements?create=1",
    icon: MegaphoneIcon,
  },
  {
    label: "Add calendar event",
    href: "/admin/calendar?tab=events&create=1",
    icon: CalendarIcon,
  },
];

/**
 * "+ Create new" dropdown. Each item navigates to the module's route with the
 * create intent flag, where the existing manager dialog opens — no duplicated
 * CRUD logic.
 */
export function CreateNewDropdown() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="cta">
          <PlusIcon className="size-4" />
          Create new
          <ChevronDownIcon className="size-3.5 text-white/80" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-56 rounded-xl border border-border/70 bg-popover p-1.5 text-sm text-popover-foreground shadow-elevated"
        >
          {CREATE_ACTIONS.map(({ label, href, icon: Icon }) => (
            <DropdownMenu.Item key={href} asChild>
              <Link
                href={href}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground outline-none select-none data-[highlighted]:bg-muted data-[highlighted]:text-foreground"
              >
                <Icon aria-hidden="true" className="size-4 text-brand-600" />
                {label}
              </Link>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}